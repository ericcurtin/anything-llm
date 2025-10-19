const Provider = require("./ai-provider.js");
const InheritMultiple = require("./helpers/classes.js");
const UnTooled = require("./helpers/untooled.js");

/**
 * The agent provider for Docker Model Runner.
 */
class DockerModelRunnerProvider extends InheritMultiple([Provider, UnTooled]) {
  model;
  client;

  constructor(config = {}) {
    const { model = null } = config;

    super();
    
    // Initialize OpenAI SDK for OpenAI-compatible API
    try {
      const { OpenAI } = require("openai");
      const headers = process.env.DOCKER_MODEL_RUNNER_AUTH_TOKEN
        ? { Authorization: `Bearer ${process.env.DOCKER_MODEL_RUNNER_AUTH_TOKEN}` }
        : {};

      this._client = new OpenAI({
        baseURL: process.env.DOCKER_MODEL_RUNNER_BASE_PATH,
        apiKey: process.env.DOCKER_MODEL_RUNNER_AUTH_TOKEN || "docker-model-runner",
        defaultHeaders: headers,
      });
      this.useOpenAISDK = true;
    } catch (error) {
      console.warn("OpenAI SDK not available for Docker Model Runner agent provider");
      this.useOpenAISDK = false;
    }

    this.model = model;
    this.verbose = true;
  }

  get client() {
    return this._client;
  }

  async #handleFunctionCallChat({ messages = [] }) {
    if (!this.useOpenAISDK) {
      return await this.#handleFunctionCallChatWithFetch({ messages });
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: 0,
    });
    return response?.choices?.[0]?.message?.content || null;
  }

  async #handleFunctionCallChatWithFetch({ messages = [] }) {
    const headers = {
      "Content-Type": "application/json",
    };
    if (process.env.DOCKER_MODEL_RUNNER_AUTH_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.DOCKER_MODEL_RUNNER_AUTH_TOKEN}`;
    }

    const response = await fetch(
      `${process.env.DOCKER_MODEL_RUNNER_BASE_PATH}/v1/chat/completions`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || null;
  }

  /**
   * Create a completion based on the received messages.
   *
   * @param messages A list of messages to send to the API.
   * @param functions
   * @returns The completion.
   */
  async complete(messages, functions = []) {
    try {
      let completion;
      if (functions.length > 0) {
        const { toolCall, text } = await this.functionCall(
          messages,
          functions,
          this.#handleFunctionCallChat.bind(this)
        );

        if (toolCall !== null) {
          this.providerLog(`Valid tool call found - running ${toolCall.name}.`);
          this.deduplicator.trackRun(toolCall.name, toolCall.arguments);
          return {
            result: null,
            functionCall: {
              name: toolCall.name,
              arguments: toolCall.arguments,
            },
            cost: 0,
          };
        }
        completion = { content: text };
      }

      if (!completion?.content) {
        this.providerLog(
          "Will assume chat completion without tool call inputs."
        );

        if (this.useOpenAISDK) {
          const response = await this.client.chat.completions.create({
            model: this.model,
            messages: this.cleanMsgs(messages),
            temperature: 0.5,
          });
          completion = response.choices[0].message;
        } else {
          const headers = {
            "Content-Type": "application/json",
          };
          if (process.env.DOCKER_MODEL_RUNNER_AUTH_TOKEN) {
            headers["Authorization"] = `Bearer ${process.env.DOCKER_MODEL_RUNNER_AUTH_TOKEN}`;
          }

          const response = await fetch(
            `${process.env.DOCKER_MODEL_RUNNER_BASE_PATH}/v1/chat/completions`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                model: this.model,
                messages: this.cleanMsgs(messages),
                temperature: 0.5,
              }),
            }
          );

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          completion = data.choices[0].message;
        }
      }

      // The UnTooled class inherited Deduplicator is mostly useful to prevent the agent
      // from calling the exact same function over and over in a loop within a single chat exchange
      // _but_ we should enable it to call previously used tools in a new chat interaction.
      this.deduplicator.reset("runs");
      return {
        result: completion.content,
        cost: 0,
      };
    } catch (error) {
      this.providerLog(
        `Docker Model Runner completion failed: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Get the cost of the completion.
   *
   * @param _usage The completion to get the cost for.
   * @returns The cost of the completion.
   * Stubbed since Docker Model Runner is free/self-hosted.
   */
  getCost(_usage) {
    return 0;
  }
}

module.exports = DockerModelRunnerProvider;
