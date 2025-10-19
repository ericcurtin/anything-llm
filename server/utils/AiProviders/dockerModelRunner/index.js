const {
  writeResponseChunk,
  clientAbortedHandler,
  formatChatHistory,
} = require("../../helpers/chat/responses");
const { NativeEmbedder } = require("../../EmbeddingEngines/native");
const {
  LLMPerformanceMonitor,
} = require("../../helpers/chat/LLMPerformanceMonitor");

// Docker Model Runner provides an OpenAI-compatible API for running LLMs in Docker containers
// This implementation supports both OpenAI SDK (for newer versions) and fetch API (fallback)
class DockerModelRunnerLLM {
  constructor(embedder = null, modelPreference = null) {
    if (!process.env.DOCKER_MODEL_RUNNER_BASE_PATH)
      throw new Error("No Docker Model Runner Base Path was set.");

    this.authToken = process.env.DOCKER_MODEL_RUNNER_AUTH_TOKEN;
    this.basePath = process.env.DOCKER_MODEL_RUNNER_BASE_PATH;
    this.model =
      modelPreference || process.env.DOCKER_MODEL_RUNNER_MODEL_PREF;
    this.performanceMode =
      process.env.DOCKER_MODEL_RUNNER_PERFORMANCE_MODE || "base";
    this.keepAlive = process.env.DOCKER_MODEL_RUNNER_KEEP_ALIVE_TIMEOUT
      ? Number(process.env.DOCKER_MODEL_RUNNER_KEEP_ALIVE_TIMEOUT)
      : 300; // Default 5-minute timeout
    this.limits = {
      history: this.promptWindowLimit() * 0.15,
      system: this.promptWindowLimit() * 0.15,
      user: this.promptWindowLimit() * 0.7,
    };

    // Initialize OpenAI SDK for compatibility
    this.#initializeClient();

    this.embedder = embedder ?? new NativeEmbedder();
    this.defaultTemp = 0.7;
    this.#log(
      `DockerModelRunnerLLM initialized with\nmodel: ${this.model}\nperf: ${this.performanceMode}\nn_ctx: ${this.promptWindowLimit()}`
    );
  }

  #initializeClient() {
    try {
      const { OpenAI } = require("openai");
      const headers = this.authToken
        ? { Authorization: `Bearer ${this.authToken}` }
        : {};

      this.client = new OpenAI({
        baseURL: this.basePath,
        apiKey: this.authToken || "docker-model-runner",
        defaultHeaders: headers,
      });
      this.useOpenAISDK = true;
    } catch (error) {
      this.#log(
        "OpenAI SDK not available or failed to initialize, using fetch API"
      );
      this.useOpenAISDK = false;
    }
  }

  #log(text, ...args) {
    console.log(`\x1b[35m[DockerModelRunner]\x1b[0m ${text}`, ...args);
  }

  #appendContext(contextTexts = []) {
    if (!contextTexts || !contextTexts.length) return "";
    return (
      "\nContext:\n" +
      contextTexts
        .map((text, i) => {
          return `[CONTEXT ${i}]:\n${text}\n[END CONTEXT ${i}]\n\n`;
        })
        .join("")
    );
  }

  streamingEnabled() {
    return "streamGetChatCompletion" in this;
  }

  static promptWindowLimit(_modelName) {
    const limit = process.env.DOCKER_MODEL_RUNNER_MODEL_TOKEN_LIMIT || 4096;
    if (!limit || isNaN(Number(limit)))
      throw new Error("No Docker Model Runner token context limit was set.");
    return Number(limit);
  }

  // Ensure the user set a value for the token limit
  // and if undefined - assume 4096 window.
  promptWindowLimit() {
    const limit = process.env.DOCKER_MODEL_RUNNER_MODEL_TOKEN_LIMIT || 4096;
    if (!limit || isNaN(Number(limit)))
      throw new Error("No Docker Model Runner token context limit was set.");
    return Number(limit);
  }

  async isValidChatCompletionModel(_ = "") {
    return true;
  }

  /**
   * Generates appropriate content array for a message + attachments.
   * @param {{userPrompt:string, attachments: import("../../helpers").Attachment[]}}
   * @returns {{role: string, content: string | Array}}
   */
  #generateContent({ userPrompt, attachments = [] }) {
    if (!attachments.length) {
      return { role: "user", content: userPrompt };
    }

    // Support multi-modal with vision capabilities
    const content = [{ type: "text", text: userPrompt }];
    
    attachments.forEach((attachment) => {
      // Check if it's an image attachment
      if (attachment.mime && attachment.mime.startsWith("image/")) {
        content.push({
          type: "image_url",
          image_url: {
            url: attachment.contentString,
          },
        });
      }
    });

    return { role: "user", content };
  }

  /**
   * Handles errors from the Docker Model Runner API to make them more user friendly.
   * @param {Error} e
   */
  #errorHandler(e) {
    const errorMessage = e.message || e.toString();
    
    if (errorMessage.includes("fetch failed") || errorMessage.includes("ECONNREFUSED")) {
      throw new Error(
        "Your Docker Model Runner instance could not be reached or is not responding. Please make sure it is running and your connection information is correct in AnythingLLM."
      );
    }
    
    if (errorMessage.includes("401") || errorMessage.includes("403")) {
      throw new Error(
        "Authentication failed. Please check your Docker Model Runner auth token."
      );
    }
    
    return e;
  }

  /**
   * Construct the user prompt for this model.
   * @param {{attachments: import("../../helpers").Attachment[]}} param0
   * @returns
   */
  constructPrompt({
    systemPrompt = "",
    contextTexts = [],
    chatHistory = [],
    userPrompt = "",
    attachments = [],
  }) {
    const prompt = {
      role: "system",
      content: `${systemPrompt}${this.#appendContext(contextTexts)}`,
    };

    // Format chat history and handle attachments properly
    const formattedHistory = formatChatHistory(
      chatHistory,
      (msg) => {
        if (msg.attachments && msg.attachments.length > 0) {
          return this.#generateContent(msg);
        }
        return { role: msg.role || "user", content: msg.content || msg.userPrompt };
      },
      "spread"
    );

    return [
      prompt,
      ...formattedHistory,
      this.#generateContent({ userPrompt, attachments }),
    ];
  }

  async getChatCompletion(messages = null, { temperature = 0.7 }) {
    if (this.useOpenAISDK) {
      return this.#getChatCompletionWithSDK(messages, { temperature });
    } else {
      return this.#getChatCompletionWithFetch(messages, { temperature });
    }
  }

  async #getChatCompletionWithSDK(messages, { temperature }) {
    const result = await LLMPerformanceMonitor.measureAsyncFunction(
      this.client.chat.completions
        .create({
          model: this.model,
          messages,
          temperature,
          max_tokens: this.maxTokens,
          stream: false,
          ...(this.performanceMode === "maximum" && {
            max_context: this.promptWindowLimit(),
          }),
        })
        .then((res) => {
          const choice = res.choices?.[0];
          return {
            content: choice?.message?.content || "",
            usage: {
              prompt_tokens: res.usage?.prompt_tokens || 0,
              completion_tokens: res.usage?.completion_tokens || 0,
              total_tokens: res.usage?.total_tokens || 0,
            },
          };
        })
        .catch((e) => {
          throw new Error(
            `DockerModelRunner::getChatCompletion failed to communicate with Docker Model Runner. ${this.#errorHandler(e).message}`
          );
        })
    );

    if (!result.output.content || !result.output.content.length)
      throw new Error(
        `DockerModelRunner::getChatCompletion text response was empty.`
      );

    return {
      textResponse: result.output.content,
      metrics: {
        prompt_tokens: result.output.usage.prompt_tokens,
        completion_tokens: result.output.usage.completion_tokens,
        total_tokens: result.output.usage.total_tokens,
        outputTps: result.output.usage.completion_tokens / result.duration,
        duration: result.duration,
      },
    };
  }

  async #getChatCompletionWithFetch(messages, { temperature }) {
    const headers = {
      "Content-Type": "application/json",
    };
    if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }

    const result = await LLMPerformanceMonitor.measureAsyncFunction(
      fetch(`${this.basePath}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature,
          max_tokens: this.maxTokens,
          stream: false,
          ...(this.performanceMode === "maximum" && {
            max_context: this.promptWindowLimit(),
          }),
        }),
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          return res.json();
        })
        .then((data) => {
          const choice = data.choices?.[0];
          return {
            content: choice?.message?.content || "",
            usage: {
              prompt_tokens: data.usage?.prompt_tokens || 0,
              completion_tokens: data.usage?.completion_tokens || 0,
              total_tokens: data.usage?.total_tokens || 0,
            },
          };
        })
        .catch((e) => {
          throw new Error(
            `DockerModelRunner::getChatCompletion failed to communicate with Docker Model Runner. ${this.#errorHandler(e).message}`
          );
        })
    );

    if (!result.output.content || !result.output.content.length)
      throw new Error(
        `DockerModelRunner::getChatCompletion text response was empty.`
      );

    return {
      textResponse: result.output.content,
      metrics: {
        prompt_tokens: result.output.usage.prompt_tokens,
        completion_tokens: result.output.usage.completion_tokens,
        total_tokens: result.output.usage.total_tokens,
        outputTps: result.output.usage.completion_tokens / result.duration,
        duration: result.duration,
      },
    };
  }

  async streamGetChatCompletion(messages = null, { temperature = 0.7 }) {
    if (this.useOpenAISDK) {
      return this.#streamGetChatCompletionWithSDK(messages, { temperature });
    } else {
      return this.#streamGetChatCompletionWithFetch(messages, { temperature });
    }
  }

  async #streamGetChatCompletionWithSDK(messages, { temperature }) {
    const measuredStreamRequest = await LLMPerformanceMonitor.measureStream(
      this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature,
        max_tokens: this.maxTokens,
        stream: true,
        ...(this.performanceMode === "maximum" && {
          max_context: this.promptWindowLimit(),
        }),
      }),
      messages,
      false
    ).catch((e) => {
      throw this.#errorHandler(e);
    });
    return measuredStreamRequest;
  }

  async #streamGetChatCompletionWithFetch(messages, { temperature }) {
    const headers = {
      "Content-Type": "application/json",
    };
    if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }

    const response = await fetch(`${this.basePath}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature,
        max_tokens: this.maxTokens,
        stream: true,
        ...(this.performanceMode === "maximum" && {
          max_context: this.promptWindowLimit(),
        }),
      }),
    }).catch((e) => {
      throw this.#errorHandler(e);
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return LLMPerformanceMonitor.measureStream(
      response.body,
      messages,
      false
    ).catch((e) => {
      throw this.#errorHandler(e);
    });
  }

  /**
   * Handles streaming responses from Docker Model Runner.
   * @param {import("express").Response} response
   * @param {import("../../helpers/chat/LLMPerformanceMonitor").MonitoredStream} stream
   * @param {import("express").Request} request
   * @returns {Promise<string>}
   */
  handleStream(response, stream, responseProps) {
    const { uuid = require("uuid").v4(), sources = [] } = responseProps;

    return new Promise(async (resolve) => {
      let fullText = "";
      let usage = {
        prompt_tokens: 0,
        completion_tokens: 0,
      };

      // Establish listener to early-abort a streaming response
      const handleAbort = () => {
        stream?.endMeasurement(usage);
        clientAbortedHandler(resolve, fullText);
      };
      response.on("close", handleAbort);

      try {
        if (this.useOpenAISDK) {
          // Handle OpenAI SDK stream format
          for await (const chunk of stream) {
            if (chunk === undefined) {
              throw new Error(
                "Stream returned undefined chunk. Aborting reply - check model provider logs."
              );
            }

            const delta = chunk.choices?.[0]?.delta;
            if (delta?.content) {
              const content = delta.content;
              fullText += content;
              writeResponseChunk(response, {
                uuid,
                sources,
                type: "textResponseChunk",
                textResponse: content,
                close: false,
                error: false,
              });
            }

            // Check if stream is done
            if (chunk.choices?.[0]?.finish_reason) {
              usage.prompt_tokens = chunk.usage?.prompt_tokens || 0;
              usage.completion_tokens = chunk.usage?.completion_tokens || 0;
              writeResponseChunk(response, {
                uuid,
                sources,
                type: "textResponseChunk",
                textResponse: "",
                close: true,
                error: false,
              });
              response.removeListener("close", handleAbort);
              stream?.endMeasurement(usage);
              resolve(fullText);
              break;
            }
          }
        } else {
          // Handle fetch API stream format
          const reader = stream.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.trim() === "" || line.trim() === "data: [DONE]")
                continue;
              if (!line.startsWith("data: ")) continue;

              try {
                const jsonStr = line.slice(6);
                const chunk = JSON.parse(jsonStr);

                const delta = chunk.choices?.[0]?.delta;
                if (delta?.content) {
                  const content = delta.content;
                  fullText += content;
                  writeResponseChunk(response, {
                    uuid,
                    sources,
                    type: "textResponseChunk",
                    textResponse: content,
                    close: false,
                    error: false,
                  });
                }

                if (chunk.choices?.[0]?.finish_reason) {
                  usage.prompt_tokens = chunk.usage?.prompt_tokens || 0;
                  usage.completion_tokens = chunk.usage?.completion_tokens || 0;
                }
              } catch (e) {
                console.error("Failed to parse SSE chunk:", e);
              }
            }
          }

          writeResponseChunk(response, {
            uuid,
            sources,
            type: "textResponseChunk",
            textResponse: "",
            close: true,
            error: false,
          });
          response.removeListener("close", handleAbort);
          stream?.endMeasurement(usage);
          resolve(fullText);
        }
      } catch (error) {
        writeResponseChunk(response, {
          uuid,
          sources: [],
          type: "textResponseChunk",
          textResponse: "",
          close: true,
          error: `DockerModelRunner:streaming - could not stream chat. ${
            error?.cause ?? error.message
          }`,
        });
        response.removeListener("close", handleAbort);
        stream?.endMeasurement(usage);
        resolve(fullText);
      }
    });
  }

  // Simple wrapper for dynamic embedder & normalize interface for all LLM implementations
  async embedTextInput(textInput) {
    return await this.embedder.embedTextInput(textInput);
  }
  
  async embedChunks(textChunks = []) {
    return await this.embedder.embedChunks(textChunks);
  }

  async compressMessages(promptArgs = {}, rawHistory = []) {
    const { messageArrayCompressor } = require("../../helpers/chat");
    const messageArray = this.constructPrompt(promptArgs);
    return await messageArrayCompressor(this, messageArray, rawHistory);
  }
}

module.exports = {
  DockerModelRunnerLLM,
};
