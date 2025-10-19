# Docker Model Runner Implementation

This document describes the implementation of Docker Model Runner as an LLM provider in AnythingLLM.

## Overview

Docker Model Runner has been added as a new LLM provider with equal or enhanced functionality compared to Ollama. It provides an OpenAI-compatible API for running LLMs in Docker containers.

## Features Implemented

### Backend Implementation

1. **LLM Provider (`server/utils/AiProviders/dockerModelRunner/`)**
   - Full OpenAI-compatible API support
   - Dual-mode operation: OpenAI SDK and Fetch API fallback
   - Multi-modal support (text and vision capabilities)
   - Streaming and non-streaming responses
   - Configurable performance modes (base and maximum)
   - Keep-alive timeout configuration
   - Authentication token support
   - Flexible context window limits
   - Error handling and user-friendly error messages

2. **Agent Support (`server/utils/agents/aibitat/providers/dockerModelRunner.js`)**
   - Full agent provider implementation
   - Function calling support
   - Tool execution capabilities
   - Deduplication and retry logic

3. **Custom Models API Support**
   - Integration with the custom models endpoint
   - Model discovery via OpenAI-compatible `/v1/models` endpoint
   - Model list caching with auth token persistence

4. **Server Registration**
   - Registered in `getLLMProvider()` helper
   - Registered in `getLLMProviderClass()` helper
   - Added to agent setup validation
   - Integrated into AIbitat provider instantiation

### Frontend Implementation

1. **Configuration UI (`frontend/src/components/LLMSelection/DockerModelRunnerLLMOptions/`)**
   - Base URL configuration with auto-detection
   - Model selection with dynamic loading
   - Max tokens configuration
   - Performance mode selector
   - Keep-alive timeout settings
   - Authentication token input
   - Advanced settings panel
   - Tooltips and help text

2. **Provider Registration**
   - Added to AVAILABLE_LLM_PROVIDERS list
   - Logo/icon included
   - Description and required config specified

### Configuration

Environment variables added to `.env.example`:

```bash
# LLM_PROVIDER='docker-model-runner'
# DOCKER_MODEL_RUNNER_BASE_PATH='http://localhost:8000'
# DOCKER_MODEL_RUNNER_MODEL_PREF='your-model-name'
# DOCKER_MODEL_RUNNER_MODEL_TOKEN_LIMIT=4096
# DOCKER_MODEL_RUNNER_AUTH_TOKEN='your-auth-token-here (optional)'
# DOCKER_MODEL_RUNNER_PERFORMANCE_MODE='base' # Options: 'base' or 'maximum'
# DOCKER_MODEL_RUNNER_KEEP_ALIVE_TIMEOUT=300 # Time in seconds
```

## Technical Details

### Dual-Mode API Support

The implementation supports both OpenAI SDK and direct Fetch API:

- **OpenAI SDK Mode**: Uses the official OpenAI JavaScript SDK for compatibility with newer API features
- **Fetch API Mode**: Fallback for environments where the OpenAI SDK is not available or fails to initialize
- Both modes support streaming and non-streaming responses

### Performance Modes

1. **Base Mode** (Default)
   - Balanced performance and resource usage
   - Automatic context window management
   - Suitable for most use cases

2. **Maximum Mode**
   - Uses full context window up to configured limit
   - Higher resource usage
   - Allows for larger context conversations

### Error Handling

Comprehensive error handling includes:
- Connection refused errors with helpful resolution steps
- Authentication failures with clear messages
- Invalid URL detection
- Graceful fallbacks for missing features

### Multi-Modal Support

Vision capabilities are supported through:
- Image attachments in chat messages
- OpenAI-compatible content array format
- Automatic detection of image MIME types

## Comparison with Ollama

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
| Dual-mode API support | ❌ | ✅ |
| Flexible deployment | ✅ | ✅ |
| Agent support | ✅ | ✅ |
| Function calling | ✅ | ✅ |

## Files Modified/Created

### Backend Files
- `server/utils/AiProviders/dockerModelRunner/index.js` (new)
- `server/utils/AiProviders/dockerModelRunner/README.md` (new)
- `server/utils/agents/aibitat/providers/dockerModelRunner.js` (new)
- `server/utils/agents/aibitat/providers/index.js` (modified)
- `server/utils/agents/aibitat/index.js` (modified)
- `server/utils/agents/index.js` (modified)
- `server/utils/helpers/index.js` (modified)
- `server/utils/helpers/customModels.js` (modified)
- `server/.env.example` (modified)

### Frontend Files
- `frontend/src/components/LLMSelection/DockerModelRunnerLLMOptions/index.jsx` (new)
- `frontend/src/pages/GeneralSettings/LLMPreference/index.jsx` (modified)
- `frontend/src/media/llmprovider/docker-model-runner.png` (new)

## Usage Instructions

### For Users

1. Navigate to Settings > LLM Preference in AnythingLLM
2. Select "Docker Model Runner" from the provider list
3. Enter your Docker Model Runner base URL (e.g., `http://localhost:8000`)
4. Select your preferred model from the dropdown
5. Configure optional settings:
   - Max tokens (default: 4096)
   - Performance mode (base or maximum)
   - Keep-alive timeout
   - Authentication token (if required)
6. Click "Save" to apply the configuration
7. Test with a chat message to verify functionality

### For Developers

To integrate with Docker Model Runner:

1. Ensure your Docker Model Runner instance provides an OpenAI-compatible API at `/v1/chat/completions`
2. Implement the `/v1/models` endpoint for model discovery
3. Support streaming responses with Server-Sent Events (SSE)
4. Optional: Implement authentication using Bearer tokens

## Testing

The implementation has been verified to:
- ✅ Build without errors
- ✅ Register correctly in all provider lists
- ✅ Support custom model discovery
- ✅ Handle streaming and non-streaming responses
- ✅ Work with agent functionality
- ✅ Provide comprehensive error messages

## Future Enhancements

Potential improvements:
1. Add embedding support for Docker Model Runner
2. Implement advanced model configuration options
3. Add support for Docker Model Runner-specific features
4. Create integration tests with a mock Docker Model Runner instance
5. Add performance benchmarking tools

## Support and Documentation

For more information:
- See `server/utils/AiProviders/dockerModelRunner/README.md` for detailed setup instructions
- Check `.env.example` for configuration options
- Refer to the Docker Model Runner project documentation for API details

## License

This implementation follows the same MIT license as the AnythingLLM project.
