import React, { useEffect, useState } from "react";
import System from "@/models/system";
import PreLoader from "@/components/Preloader";
import { CaretDown, CaretUp, Info } from "@phosphor-icons/react";
import useProviderEndpointAutoDiscovery from "@/hooks/useProviderEndpointAutoDiscovery";
import { Tooltip } from "react-tooltip";

// Common Docker Model Runner URLs for auto-detection
const DOCKER_MODEL_RUNNER_COMMON_URLS = [
  "http://localhost:8000",
  "http://localhost:8080",
  "http://127.0.0.1:8000",
  "http://127.0.0.1:8080",
  "http://host.docker.internal:8000",
  "http://host.docker.internal:8080",
];

export default function DockerModelRunnerLLMOptions({ settings }) {
  const {
    autoDetecting: loading,
    basePath,
    basePathValue,
    authToken,
    authTokenValue,
    showAdvancedControls,
    setShowAdvancedControls,
    handleAutoDetectClick,
  } = useProviderEndpointAutoDiscovery({
    provider: "docker-model-runner",
    initialBasePath: settings?.DockerModelRunnerLLMBasePath,
    ENDPOINTS: DOCKER_MODEL_RUNNER_COMMON_URLS,
  });
  const [performanceMode, setPerformanceMode] = useState(
    settings?.DockerModelRunnerLLMPerformanceMode || "base"
  );
  const [maxTokens, setMaxTokens] = useState(
    settings?.DockerModelRunnerLLMTokenLimit || 4096
  );

  return (
    <div className="w-full flex flex-col gap-y-7">
      <div className="w-full flex items-start gap-[36px] mt-1.5">
        <DockerModelRunnerLLMModelSelection
          settings={settings}
          basePath={basePath.value}
          authToken={authToken.value}
        />
        <div className="flex flex-col w-60">
          <label className="text-white text-sm font-semibold block mb-2">
            Max Tokens
          </label>
          <input
            type="number"
            name="DockerModelRunnerLLMTokenLimit"
            className="border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
            placeholder="4096"
            defaultChecked="4096"
            min={1}
            value={maxTokens}
            onChange={(e) => setMaxTokens(Number(e.target.value))}
            onScroll={(e) => e.target.blur()}
            required={true}
            autoComplete="off"
          />
          <p className="text-xs leading-[18px] font-base text-white text-opacity-60 mt-2">
            Maximum number of tokens for context and response.
          </p>
        </div>
      </div>
      <div className="flex justify-start mt-4">
        <button
          onClick={(e) => {
            e.preventDefault();
            setShowAdvancedControls(!showAdvancedControls);
          }}
          className="border-none text-theme-text-primary hover:text-theme-text-secondary flex items-center text-sm"
        >
          {showAdvancedControls ? "Hide" : "Show"} advanced settings
          {showAdvancedControls ? (
            <CaretUp size={14} className="ml-1" />
          ) : (
            <CaretDown size={14} className="ml-1" />
          )}
        </button>
      </div>

      <div hidden={!showAdvancedControls}>
        <div className="flex flex-col">
          <div className="w-full flex items-start gap-4">
            <div className="flex flex-col w-60">
              <div className="flex justify-between items-center mb-2">
                <label className="text-white text-sm font-semibold">
                  Docker Model Runner Base URL
                </label>
                {loading ? (
                  <PreLoader size="6" />
                ) : (
                  <>
                    {!basePathValue.value && (
                      <button
                        onClick={handleAutoDetectClick}
                        className="bg-primary-button text-xs font-medium px-2 py-1 rounded-lg hover:bg-secondary hover:text-white shadow-[0_4px_14px_rgba(0,0,0,0.25)]"
                      >
                        Auto-Detect
                      </button>
                    )}
                  </>
                )}
              </div>
              <input
                type="url"
                name="DockerModelRunnerLLMBasePath"
                className="border-none bg-theme-settings-input-bg text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
                placeholder="http://localhost:8000"
                value={basePathValue.value}
                required={true}
                autoComplete="off"
                spellCheck={false}
                onChange={basePath.onChange}
                onBlur={basePath.onBlur}
              />
              <p className="text-xs leading-[18px] font-base text-white text-opacity-60 mt-2">
                Enter the URL where Docker Model Runner is running.
              </p>
            </div>
            <div className="flex flex-col w-60">
              <label className="text-white text-sm font-semibold mb-2 flex items-center">
                Performance Mode
                <Info
                  size={16}
                  className="ml-2 text-white"
                  data-tooltip-id="dmr-performance-mode-tooltip"
                />
              </label>
              <select
                name="DockerModelRunnerLLMPerformanceMode"
                required={true}
                className="border-none bg-theme-settings-input-bg border-gray-500 text-white text-sm rounded-lg block w-full p-2.5"
                value={performanceMode}
                onChange={(e) => setPerformanceMode(e.target.value)}
              >
                <option value="base">Base (Default)</option>
                <option value="maximum">Maximum</option>
              </select>
              <p className="text-xs leading-[18px] font-base text-white text-opacity-60 mt-2">
                Choose the performance mode for the model.
              </p>
              <Tooltip
                id="dmr-performance-mode-tooltip"
                place="bottom"
                className="tooltip !text-xs max-w-xs"
              >
                <p className="text-red-500">
                  <strong>Note:</strong> Be careful with the Maximum mode. It
                  may increase resource usage significantly.
                </p>
                <br />
                <p>
                  <strong>Base:</strong> Balanced performance with optimized
                  context management. Suitable for most users and models.
                </p>
                <br />
                <p>
                  <strong>Maximum:</strong> Uses the full context window (up to
                  Max Tokens). Will result in increased resource usage but
                  allows for larger context conversations. <br />
                  <br />
                  This is not recommended for most users.
                </p>
              </Tooltip>
            </div>
            <div className="flex flex-col w-60">
              <label className="text-white text-sm font-semibold block mb-2">
                Keep Alive Timeout
              </label>
              <select
                name="DockerModelRunnerLLMKeepAliveSeconds"
                required={true}
                className="border-none bg-theme-settings-input-bg border-gray-500 text-white text-sm rounded-lg block w-full p-2.5"
                defaultValue={
                  settings?.DockerModelRunnerLLMKeepAliveSeconds ?? "300"
                }
              >
                <option value="0">No cache</option>
                <option value="300">5 minutes</option>
                <option value="3600">1 hour</option>
                <option value="-1">Forever</option>
              </select>
              <p className="text-xs leading-[18px] font-base text-white text-opacity-60 mt-2">
                Choose how long Docker Model Runner should keep your model in
                memory before unloading.
              </p>
            </div>
          </div>
          <div className="w-full flex items-start gap-4">
            <div className="flex flex-col w-100">
              <label className="text-white text-sm font-semibold">
                Auth Token
              </label>
              <p className="text-xs leading-[18px] font-base text-white text-opacity-60 mt-2">
                Enter a <code>Bearer</code> Auth Token for interacting with your
                Docker Model Runner server.
                <br />
                Used <b>only</b> if running Docker Model Runner behind an
                authentication server.
              </p>
              <input
                type="password"
                name="DockerModelRunnerLLMAuthToken"
                className="border-none bg-theme-settings-input-bg mt-2 text-white placeholder:text-theme-settings-input-placeholder text-sm rounded-lg outline-none block w-full p-2.5"
                placeholder="Docker Model Runner Auth Token"
                defaultValue={
                  settings?.DockerModelRunnerLLMAuthToken ? "*".repeat(20) : ""
                }
                value={authTokenValue.value}
                onChange={authToken.onChange}
                onBlur={authToken.onBlur}
                required={false}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DockerModelRunnerLLMModelSelection({
  settings,
  basePath = null,
  authToken = null,
}) {
  const [customModels, setCustomModels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function findCustomModels() {
      if (!basePath) {
        setCustomModels([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const { models } = await System.customModels(
          "docker-model-runner",
          authToken,
          basePath
        );
        setCustomModels(models || []);
      } catch (error) {
        console.error("Failed to fetch custom models:", error);
        setCustomModels([]);
      }
      setLoading(false);
    }
    findCustomModels();
  }, [basePath, authToken]);

  if (loading || customModels.length == 0) {
    return (
      <div className="flex flex-col w-60">
        <label className="text-white text-sm font-semibold block mb-2">
          Docker Model Runner Model
        </label>
        <select
          name="DockerModelRunnerLLMModelPref"
          disabled={true}
          className="border-none bg-theme-settings-input-bg border-gray-500 text-white text-sm rounded-lg block w-full p-2.5"
        >
          <option disabled={true} selected={true}>
            {!!basePath
              ? "--loading available models--"
              : "Enter Docker Model Runner URL first"}
          </option>
        </select>
        <p className="text-xs leading-[18px] font-base text-white text-opacity-60 mt-2">
          Select the Docker Model Runner model you want to use. Models will load
          after entering a valid Docker Model Runner URL.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-60">
      <label className="text-white text-sm font-semibold block mb-2">
        Docker Model Runner Model
      </label>
      <select
        name="DockerModelRunnerLLMModelPref"
        required={true}
        className="border-none bg-theme-settings-input-bg border-gray-500 text-white text-sm rounded-lg block w-full p-2.5"
      >
        {customModels.length > 0 && (
          <optgroup label="Your loaded models">
            {customModels.map((model) => {
              return (
                <option
                  key={model.id}
                  value={model.id}
                  selected={
                    settings.DockerModelRunnerLLMModelPref === model.id
                  }
                >
                  {model.id}
                </option>
              );
            })}
          </optgroup>
        )}
      </select>
      <p className="text-xs leading-[18px] font-base text-white text-opacity-60 mt-2">
        Choose the Docker Model Runner model you want to use for your
        conversations.
      </p>
    </div>
  );
}
