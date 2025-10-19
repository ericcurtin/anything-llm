# Docker Model Runner for AnythingLLM

Docker Model Runner is an OpenAI-compatible API provider for running LLMs in Docker containers. This integration allows you to use Docker Model Runner as a local LLM provider with AnythingLLM.

## Features

- ✅ Full OpenAI-compatible API support
- ✅ Multi-modal support (text and vision)
- ✅ Streaming and non-streaming responses
- ✅ Configurable performance modes
- ✅ Keep-alive timeout configuration
- ✅ Authentication token support
- ✅ Flexible context window limits

## Configuration

Docker Model Runner requires the following environment variables to be set:

### Required Settings

- `DOCKER_MODEL_RUNNER_BASE_PATH`: The base URL where Docker Model Runner is running (e.g., `http://localhost:8000`)
- `DOCKER_MODEL_RUNNER_MODEL_PREF`: The model you want to use
- `DOCKER_MODEL_RUNNER_MODEL_TOKEN_LIMIT`: Maximum number of tokens for context and response (default: 4096)

### Optional Settings

- `DOCKER_MODEL_RUNNER_AUTH_TOKEN`: Bearer token for authentication (if your instance requires it)
- `DOCKER_MODEL_RUNNER_PERFORMANCE_MODE`: Performance mode - either `base` (default) or `maximum`
- `DOCKER_MODEL_RUNNER_KEEP_ALIVE_TIMEOUT`: How long to keep the model in memory in seconds (default: 300)

## Performance Modes

### Base Mode (Default)
- Optimized for balanced performance and resource usage
- Automatically manages context window
- Suitable for most use cases

### Maximum Mode
- Uses the full context window (up to `DOCKER_MODEL_RUNNER_MODEL_TOKEN_LIMIT`)
- Higher resource usage but allows for larger conversations
- Recommended only for specific use cases requiring large context

## Common Issues

### Connection Refused Error

If you encounter an error like `ECONNREFUSED` when using AnythingLLM in a Docker container, this means AnythingLLM cannot reach your Docker Model Runner instance.

**Solutions:**

1. **If Docker Model Runner is on the host machine:**
   - Use `http://host.docker.internal:PORT` as the base path (on Mac/Windows)
   - Use `http://172.17.0.1:PORT` as the base path (on Linux)

2. **If both are Docker containers:**
   - Put both containers on the same Docker network
   - Use the container name as the hostname: `http://docker-model-runner:PORT`

3. **Configure Docker Model Runner to bind to all interfaces:**
   - Ensure Docker Model Runner is listening on `0.0.0.0` and not just `localhost`

### Authentication Errors

If you receive 401 or 403 errors:
- Verify your `DOCKER_MODEL_RUNNER_AUTH_TOKEN` is correct
- Check that your Docker Model Runner instance is configured to accept the token
- Some instances may not require authentication - try removing the token setting

## Setting Up Docker Model Runner

Docker Model Runner should provide an OpenAI-compatible API endpoint at `/v1/chat/completions`. Make sure:

1. Docker Model Runner is running and accessible
2. The API endpoint is reachable from AnythingLLM
3. Your model is loaded and available
4. Authentication is properly configured (if required)

## Testing Your Configuration

To verify your Docker Model Runner setup:

1. Navigate to Settings > LLM Preference in AnythingLLM
2. Select "Docker Model Runner" as your LLM provider
3. Enter your Docker Model Runner base path
4. Select your preferred model from the dropdown
5. Click "Save" and test with a chat message

## Comparison with Ollama

Docker Model Runner provides equal or enhanced functionality compared to Ollama:

| Feature | Ollama | Docker Model Runner |
|---------|--------|---------------------|
| Local execution | ✅ | ✅ |
| OpenAI-compatible API | ✅ | ✅ |
| Streaming support | ✅ | ✅ |
| Multi-modal (vision) | ✅ | ✅ |
| Custom models | ✅ | ✅ |
| Keep-alive configuration | ✅ | ✅ |
| Performance modes | ✅ | ✅ |
| Authentication support | Limited | ✅ Enhanced |
| Flexible deployment | ✅ | ✅ |

## Additional Resources

For more information about Docker Model Runner, visit the project repository or documentation.
