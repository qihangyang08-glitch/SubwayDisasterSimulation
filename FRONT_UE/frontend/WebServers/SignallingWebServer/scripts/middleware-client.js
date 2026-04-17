(function (global) {
  function nowRequestId() {
    return "req-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function createEnvelope(simulationId, messageType, payload, requestId) {
    return {
      version: "1.0",
      requestId: requestId || nowRequestId(),
      simulationId: simulationId || "",
      messageType: messageType,
      sentAt: Date.now(),
      payload: payload || {}
    };
  }

  function toJson(response) {
    if (!response.ok) {
      return response.json().then(function (errorBody) {
        var error = new Error("HTTP request failed");
        error.status = response.status;
        error.body = errorBody;
        throw error;
      });
    }
    return response.json();
  }

  function createClient() {
    var state = {
      httpBaseUrl: (global.localStorage && global.localStorage.getItem("middlewareHttpBaseUrl")) || "http://127.0.0.1:3100",
      socketBaseUrl: (global.localStorage && global.localStorage.getItem("middlewareSocketBaseUrl")) || "http://127.0.0.1:3100",
      simulationId: "",
      clientRole: "frontend",
      socket: null
    };

    function saveBaseUrls() {
      if (global.localStorage) {
        global.localStorage.setItem("middlewareHttpBaseUrl", state.httpBaseUrl);
        global.localStorage.setItem("middlewareSocketBaseUrl", state.socketBaseUrl);
      }
    }

    function request(path, options) {
      return fetch(state.httpBaseUrl + path, options).then(toJson);
    }

    function connectSocket(onEvent, options) {
      if (!global.io) {
        throw new Error("Socket.IO client script is not loaded");
      }

      options = options || {};
      state.clientRole = options.clientRole || state.clientRole || "frontend";

      if (state.socket) {
        state.socket.disconnect();
      }

      state.socket = global.io(state.socketBaseUrl, {
        transports: ["websocket"],
        query: {
          simulationId: state.simulationId || "",
          clientRole: state.clientRole
        }
      });

      state.socket.on("connect", function () {
        console.info("[MiddlewareClient] Socket connected:", state.socketBaseUrl);
        if (global.AppBus) {
          global.AppBus.emit("socket:status", { status: "ok" });
        }
        if (state.simulationId) {
          state.socket.emit("subscribe", {
            simulationId: state.simulationId,
            requestId: nowRequestId(),
            clientRole: state.clientRole
          });
        }
      });

      state.socket.on("disconnect", function () {
        console.warn("[MiddlewareClient] Socket disconnected");
        if (global.AppBus) {
          global.AppBus.emit("socket:status", { status: "warn" });
        }
      });

      state.socket.on("connect_error", function (error) {
        console.error("[MiddlewareClient] Socket connect error:", error && error.message ? error.message : error);
      });

      ["UpdateFrame", "SimState", "Ack", "ControlCamera", "PlanCommand"].forEach(function (eventName) {
        state.socket.on(eventName, function (envelope) {
          if (typeof onEvent === "function") {
            onEvent(eventName, envelope || {});
          }
        });
      });

      return state.socket;
    }

    function emitControl(eventName, payload) {
      if (!state.socket) {
        throw new Error("Socket is not connected");
      }
      var envelope = createEnvelope(state.simulationId, "ControlCommand", payload, nowRequestId());
      state.socket.emit(eventName, envelope);
      return envelope.requestId;
    }

    return {
      getState: function () {
        return Object.assign({}, state);
      },
      setBaseUrls: function (httpBaseUrl, socketBaseUrl) {
        state.httpBaseUrl = httpBaseUrl || state.httpBaseUrl;
        state.socketBaseUrl = socketBaseUrl || state.socketBaseUrl;
        saveBaseUrls();
      },
      setSimulationId: function (simulationId) {
        state.simulationId = simulationId || "";
      },
      setClientRole: function (clientRole) {
        state.clientRole = clientRole || "frontend";
      },
      createEnvelope: createEnvelope,
      nowRequestId: nowRequestId,
      connectSocket: connectSocket,
      socketSubscribe: function (simulationId, clientRole) {
        state.simulationId = simulationId;
        if (clientRole) {
          state.clientRole = clientRole;
        }
        if (!state.socket) {
          return;
        }
        state.socket.emit("subscribe", {
          simulationId: simulationId,
          requestId: nowRequestId(),
          clientRole: state.clientRole
        });
      },
      emitPlay: function () {
        return emitControl("play", { action: "play" });
      },
      emitPause: function () {
        return emitControl("pause", { action: "pause" });
      },
      emitSeek: function (targetTime) {
        return emitControl("seek", { action: "seek", targetTime: Number(targetTime) || 0 });
      },
      emitSetSpeed: function (speed) {
        return emitControl("setSpeed", { action: "setSpeed", speed: Number(speed) || 1 });
      },
      emitControlCamera: function (cameraCommand) {
        if (!state.socket) {
          throw new Error("Socket is not connected");
        }
        var envelope = createEnvelope(state.simulationId, "ControlCommand", { cameraCommand: cameraCommand || {} }, nowRequestId());
        state.socket.emit("ControlCamera", envelope);
        return envelope.requestId;
      },
      listSimulations: function () {
        return request("/api/simulations", { method: "GET" });
      },
      getSimulationInfo: function (simulationId) {
        return request("/api/simulations/" + encodeURIComponent(simulationId) + "/info", { method: "GET" });
      },
      getFrameByTime: function (simulationId, targetTime) {
        return request(
          "/api/simulations/" + encodeURIComponent(simulationId) + "/frame?time=" + encodeURIComponent(String(targetTime)),
          { method: "GET" }
        );
      },
      getFrameByIndex: function (simulationId, frameIndex) {
        return request(
          "/api/simulations/" + encodeURIComponent(simulationId) + "/frame/" + encodeURIComponent(String(frameIndex)),
          { method: "GET" }
        );
      },
      createSimulation: function (initConfig) {
        return request("/api/simulations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-request-id": nowRequestId()
          },
          body: JSON.stringify(initConfig)
        });
      },
      insertFrames: function (simulationId, frames) {
        return request("/api/simulations/" + encodeURIComponent(simulationId) + "/frames", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-request-id": nowRequestId()
          },
          body: JSON.stringify({ frames: frames })
        });
      },
      createPlan: function (planConfig) {
        return request("/api/plans", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-request-id": nowRequestId()
          },
          body: JSON.stringify(planConfig)
        });
      },
      applyPlan: function (planId, body) {
        return request("/api/plans/" + encodeURIComponent(planId) + "/apply", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-request-id": nowRequestId()
          },
          body: JSON.stringify(body || {})
        });
      },
      startIntegrationBackend: function (simulationId, options) {
        return request("/api/integration/backend/start", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-request-id": nowRequestId()
          },
          body: JSON.stringify({
            simulationId: simulationId,
            options: options || {}
          })
        });
      },
      requestIntegrationPlan: function (body) {
        return request("/api/integration/llm/plan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-request-id": nowRequestId()
          },
          body: JSON.stringify(body || {})
        });
      }
    };
  }

  global.MiddlewareClient = createClient();
})(window);
