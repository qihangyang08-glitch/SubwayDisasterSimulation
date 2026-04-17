(function (global) {
  var state = {
    sidebarCollapsed: false,
    simulationId: "",
    latestFrame: null,
    latestSimState: null,
    minSimTime: 0,
    maxSimTime: 0,
    maxFrameIndex: 100,
    currentFrameIndex: 0,
    stepFrames: 1,
    seekingTarget: null,
    analysisVisible: false,
    middlewareConnected: false,
    socketConnected: false,
    pendingAck: {},
    bootstrapped: false,
    createEntities: [],
    staffSeed: 1,
    completionNotifiedFor: "",
    mockProgressTimer: null,
    mockPlayableNotifiedFor: ""
  };

  // device 固定ID池，后续若需调整数量/类型，仅需修改该常量。
  var DEVICE_CATALOG = [
    { entityId: "device_warning_01", entityType: "warningLight" },
    { entityId: "device_broadcast_01", entityType: "broadcast" },
    { entityId: "device_warning_02", entityType: "warningLight" },
    { entityId: "device_broadcast_02", entityType: "broadcast" },
    { entityId: "device_warning_03", entityType: "warningLight" }
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function safeNumber(v, fallback) {
    var n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function addLog(msg, type) {
    var bar = $("mini-log");
    if (!bar) {
      return;
    }
    var level = type ? "[" + type.toUpperCase() + "] " : "";
    bar.textContent = new Date().toLocaleTimeString() + " " + level + msg;
  }

  function clearMockProgressProbe() {
    if (state.mockProgressTimer) {
      clearInterval(state.mockProgressTimer);
      state.mockProgressTimer = null;
    }
  }

  function startMockProgressProbe(simId) {
    clearMockProgressProbe();

    if (!simId) {
      return;
    }

    var startedAt = Date.now();
    var timeoutMs = 120000;

    state.mockProgressTimer = setInterval(function () {
      if (state.simulationId !== simId) {
        clearMockProgressProbe();
        return;
      }

      if (Date.now() - startedAt > timeoutMs) {
        clearMockProgressProbe();
        addLog("模拟后端进度轮询超时，请检查服务日志", "warn");
        return;
      }

      global.MiddlewareClient.getSimulationInfo(simId)
        .then(function (res) {
          var payload = res && res.payload ? res.payload : {};
          var maxSimTime = Number(payload.maxSimTime);
          if (!Number.isFinite(maxSimTime)) {
            return null;
          }

          state.minSimTime = safeNumber(payload.minSimTime, state.minSimTime);
          state.maxSimTime = maxSimTime;
          syncTimelineView();

          if (state.mockPlayableNotifiedFor !== simId) {
            state.mockPlayableNotifiedFor = simId;
            setAck("ok", "已可开始播放");
            addLog("已收到仿真帧，可开始播放", "ok");
          }

          return global.MiddlewareClient.getFrameByTime(simId, maxSimTime)
            .then(function (frameRes) {
              return parseFrameFromEnvelope(frameRes);
            })
            .catch(function () {
              return null;
            });
        })
        .then(function (frame) {
          if (!frame || frame.simulationId !== simId) {
            return;
          }

          if (frame.status === "completed" && state.completionNotifiedFor !== simId) {
            state.completionNotifiedFor = simId;
            setAck("ok", "仿真计算完成，可开始播放");
            addLog("仿真计算完成（已可完整回放）", "ok");
            clearMockProgressProbe();
          }
        })
        .catch(function () {
          // Keep polling. Temporary API/network errors are tolerated.
        });
    }, 1000);
  }

  function setDot(id, statusText, cls) {
    var dot = $(id + "-dot");
    var text = $(id + "-text");
    if (!dot || !text) {
      return;
    }
    dot.classList.remove("ok", "warn", "error");
    if (cls) {
      dot.classList.add(cls);
    }
    text.textContent = statusText;
  }

  function updateTopbar() {
    $("top-sim-id").textContent = state.simulationId || "-";
    var simTime = state.latestSimState && Number.isFinite(Number(state.latestSimState.currentTime))
      ? Number(state.latestSimState.currentTime)
      : (state.latestFrame && Number.isFinite(Number(state.latestFrame.simTime)) ? Number(state.latestFrame.simTime) : 0);
    $("top-sim-time").textContent = simTime.toFixed(2) + "s";

    setDot("http", state.middlewareConnected ? "HTTP已连" : "HTTP断开", state.middlewareConnected ? "ok" : "error");
    setDot("socket", state.socketConnected ? "Socket已连" : "Socket断开", state.socketConnected ? "ok" : "warn");

    var pixelOk = global.ws && global.ws.readyState === 1;
    var ueOk = !!global.webRtcPlayerObj;
    setDot("pixel", pixelOk ? "流已连" : "流断开", pixelOk ? "ok" : "warn");
    setDot("ue", ueOk ? "UE在线" : "UE离线", ueOk ? "ok" : "warn");

    var placeholder = $("player-placeholder");
    if (placeholder) {
      if (ueOk) {
        placeholder.style.display = "none";
      } else {
        placeholder.style.display = ""; // flex is set by css
      }
    }
  }

  function setAck(status, text) {
    var badge = $("ack-badge");
    if (!badge) {
      return;
    }
    badge.classList.remove("pending", "ok", "error");
    if (status) {
      badge.classList.add(status);
    }
    badge.textContent = text;
  }

  function parseFrameFromEnvelope(envelope) {
    if (!envelope) {
      return null;
    }
    if (envelope.payload && typeof envelope.payload === "object") {
      return envelope.payload;
    }
    return envelope;
  }

  function updateAnalysis(frame) {
    if (!frame) {
      return;
    }
    var stats = frame.statistics || frame.metrics || {};
    var disasters = frame.disasters || {};
    var water = disasters.water || frame.water || {};
    var fire = disasters.fire || frame.fire || {};

    var totalPeople = safeNumber(stats.totalPeople || stats.peopleTotal || frame.totalPeople, 0);
    var waterLevel = safeNumber(water.level || water.height || stats.waterLevel, 0);
    var smokeRange = safeNumber(fire.smokeRange || fire.range || stats.smokeRange, 0);
    var affected = safeNumber(stats.affectedPeople || stats.impactedPeople || frame.affectedPeople, 0);
    var severity = safeNumber(stats.affectedLevel || stats.severity || frame.affectedLevel, 0);

    $("metric-total-people").textContent = String(totalPeople);
    $("metric-water-level").textContent = waterLevel.toFixed(2);
    $("metric-smoke-range").textContent = smokeRange.toFixed(2);
    $("metric-affected-people").textContent = String(affected);
    $("metric-affected-level").textContent = severity.toFixed(2);
  }

  function syncTimelineView() {
    var slider = $("timeline-slider");
    if (!slider) {
      return;
    }

    slider.max = String(Math.max(state.maxFrameIndex, 1));
    slider.value = String(Math.max(0, Math.min(state.currentFrameIndex, state.maxFrameIndex)));
    $("frame-index-view").textContent = String(state.currentFrameIndex);

    var percent = state.maxFrameIndex > 0 ? (state.currentFrameIndex / state.maxFrameIndex) * 100 : 0;
    $("progress-view").textContent = percent.toFixed(1) + "%";

    var simTime = state.latestSimState && Number.isFinite(Number(state.latestSimState.currentTime))
      ? Number(state.latestSimState.currentTime)
      : (state.latestFrame && Number.isFinite(Number(state.latestFrame.simTime)) ? Number(state.latestFrame.simTime) : 0);
    $("time-view").textContent = simTime.toFixed(2) + "s";
  }

  function toFrameIndex(frame) {
    if (!frame) {
      return null;
    }
    var n = Number(frame.frameIndex);
    if (Number.isFinite(n)) {
      return Math.max(0, Math.floor(n));
    }
    return null;
  }

  function onFrameUpdate(envelope) {
    var frame = parseFrameFromEnvelope(envelope);
    state.latestFrame = frame;

    var idx = toFrameIndex(frame);
    if (idx !== null) {
      if (state.seekingTarget !== null) {
        var closeEnough = Math.abs(idx - state.seekingTarget) <= 1;
        if (closeEnough) {
          state.currentFrameIndex = idx;
          state.seekingTarget = null;
          setAck("ok", "seek同步完成");
        }
      } else {
        state.currentFrameIndex = idx;
      }
      state.maxFrameIndex = Math.max(state.maxFrameIndex, idx);
    }

    updateAnalysis(frame);
    syncTimelineView();
    updateTopbar();

    if (frame && frame.status === "completed" && state.completionNotifiedFor !== state.simulationId) {
      state.completionNotifiedFor = state.simulationId;
      setAck("ok", "仿真计算完成");
      addLog("仿真计算完成（收到完成帧）", "ok");
    }

    var placeholder = $("player-placeholder");
    if (placeholder) {
      placeholder.style.display = "none";
    }
  }

  function onSimState(envelope) {
    var previousState = state.latestSimState && state.latestSimState.state;
    state.latestSimState = parseFrameFromEnvelope(envelope);
    updateTopbar();
    syncTimelineView();

    var currentState = state.latestSimState && state.latestSimState.state;
    var currentTime = state.latestSimState && Number.isFinite(Number(state.latestSimState.currentTime))
      ? Number(state.latestSimState.currentTime)
      : 0;
    var reachedEnd = state.maxSimTime > 0 && currentTime >= state.maxSimTime - 0.001;
    if (
      previousState === "playing"
      && currentState === "paused"
      && reachedEnd
      && state.completionNotifiedFor !== state.simulationId
    ) {
      state.completionNotifiedFor = state.simulationId;
      setAck("ok", "仿真计算完成");
      addLog("仿真计算完成（播放到末尾）", "ok");
    }
  }

  function onAck(envelope) {
    var payload = envelope && envelope.payload ? envelope.payload : {};
    if (payload.status === "error") {
      setAck("error", "Ack错误");
      return;
    }
    if (payload.status === "pending") {
      setAck("pending", "Ack处理中");
      return;
    }
    setAck("ok", "Ack已确认");
  }

  function inferTargetTimeByFrame(index) {
    if (!Number.isFinite(index) || index < 0) {
      return 0;
    }
    if (state.maxFrameIndex <= 0) {
      return Math.max(0, state.minSimTime);
    }
    var ratio = index / state.maxFrameIndex;
    return state.minSimTime + (state.maxSimTime - state.minSimTime) * ratio;
  }

  function seekByFrame(index) {
    if (!state.simulationId) {
      addLog("请先创建或输入仿真ID", "warn");
      return;
    }

    index = Math.max(0, Math.floor(index));
    state.seekingTarget = index;
    setAck("pending", "seek同步中");

    global.MiddlewareClient.getFrameByIndex(state.simulationId, index)
      .then(function (res) {
        var frame = parseFrameFromEnvelope(res);
        var targetTime = Number(frame.simTime);
        if (!Number.isFinite(targetTime)) {
          targetTime = inferTargetTimeByFrame(index);
        }
        global.MiddlewareClient.emitSeek(targetTime);
        addLog("发送seek: frame=" + index + ", time=" + targetTime.toFixed(2) + "s", "info");
      })
      .catch(function () {
        var fallbackTime = inferTargetTimeByFrame(index);
        try {
          global.MiddlewareClient.emitSeek(fallbackTime);
          addLog("按比例回退seek: frame=" + index + ", time=" + fallbackTime.toFixed(2) + "s", "warn");
        } catch (err) {
          setAck("error", "seek失败");
          addLog("seek失败: " + err.message, "error");
        }
      });

    state.currentFrameIndex = index;
    syncTimelineView();
  }

  function stepSeek(delta) {
    var next = state.currentFrameIndex + delta;
    next = Math.max(0, Math.min(next, state.maxFrameIndex || next));
    seekByFrame(next);
  }

  function readSimulationInfo(simId) {
    if (!simId) {
      return;
    }
    global.MiddlewareClient.getSimulationInfo(simId)
      .then(function (res) {
        var payload = res && res.payload ? res.payload : {};
        var minTime = safeNumber(payload.minSimTime, 0);
        var maxTime = safeNumber(payload.maxSimTime, 0);
        state.minSimTime = minTime;
        state.maxSimTime = maxTime;
        syncTimelineView();
      })
      .catch(function () {
        addLog("读取仿真时间范围失败，使用默认范围", "warn");
      });
  }

  function randomScenarioId() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    var rand = String(Math.floor(Math.random() * 9000) + 1000);
    return "metro_" + y + m + day + "_" + rand;
  }

  function getUsedDeviceIds() {
    return state.createEntities
      .filter(function (e) { return e.__kind === "device"; })
      .map(function (e) { return e.entityId; });
  }

  function getDeviceMetaById(entityId) {
    for (var i = 0; i < DEVICE_CATALOG.length; i += 1) {
      if (DEVICE_CATALOG[i].entityId === entityId) {
        return DEVICE_CATALOG[i];
      }
    }
    return null;
  }

  function getFirstAvailableDeviceId() {
    var used = getUsedDeviceIds();
    for (var i = 0; i < DEVICE_CATALOG.length; i += 1) {
      if (used.indexOf(DEVICE_CATALOG[i].entityId) === -1) {
        return DEVICE_CATALOG[i].entityId;
      }
    }
    return "";
  }

  function createDefaultEntity(kind) {
    if (kind === "device") {
      var defaultDeviceId = getFirstAvailableDeviceId();
      var meta = getDeviceMetaById(defaultDeviceId) || DEVICE_CATALOG[0];
      return {
        __kind: "device",
        entityId: meta.entityId,
        entityType: meta.entityType,
        position: [900, -300, 260],
        triggerAt: 60,
        config: meta.entityType === "broadcast"
          ? {
            enabled: true,
            messageTemplate: "请沿A出口有序疏散",
            effectRadius: 35,
            guideBoostProb: 0.18
          }
          : {
            blink: true,
            effectRadius: 20,
            guideBoostProb: 0.12
          }
      };
    }

    var staffIndex = state.staffSeed;
    state.staffSeed += 1;
    var suffix = String(staffIndex).padStart(2, "0");
    return {
      __kind: "staff",
      entityId: "staff_custom_" + suffix,
      entityType: "staffGuide",
      position: [820, -180, 10],
      triggerAt: 90,
      config: {
        moveTarget: [1000, -250, 10],
        onArriveAction: "evacuate",
        guideBoostProb: 0.2
      }
    };
  }

  function ensureEntityShape(entity) {
    if (!Array.isArray(entity.position) || entity.position.length < 3) {
      entity.position = [0, 0, 0];
    }
    if (typeof entity.config !== "object" || !entity.config) {
      entity.config = {};
    }
  }

  function ensureMoveTarget(config) {
    if (!Array.isArray(config.moveTarget) || config.moveTarget.length < 3) {
      config.moveTarget = [0, 0, 0];
    }
  }

  function updateCreateTypeSelector() {
    var selector = $("sel-entity-type");
    if (!selector) {
      return;
    }
    var deviceOption = selector.querySelector("option[value='device']");
    if (deviceOption) {
      var full = getUsedDeviceIds().length >= DEVICE_CATALOG.length;
      deviceOption.disabled = full;
      if (full && selector.value === "device") {
        selector.value = "";
      }
    }
  }

  function renderSpecialEntities() {
    var list = $("special-entity-list");
    if (!list) {
      return;
    }

    list.innerHTML = "";
    state.createEntities.forEach(function (entity, index) {
      ensureEntityShape(entity);

      var card = document.createElement("div");
      card.className = "entity-card";

      var head = document.createElement("div");
      head.className = "entity-card-head";
      var title = document.createElement("div");
      title.className = "entity-card-title";
      title.textContent = (entity.__kind === "device" ? "Device" : "Staff") + " #" + (index + 1);
      var removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "ghost-btn entity-remove-btn";
      removeBtn.setAttribute("data-action", "remove");
      removeBtn.setAttribute("data-index", String(index));
      removeBtn.textContent = "删除";
      head.appendChild(title);
      head.appendChild(removeBtn);

      var body = document.createElement("div");
      body.className = "entity-card-body";

      if (entity.__kind === "device") {
        var used = getUsedDeviceIds();
        var idOptions = DEVICE_CATALOG.map(function (d) {
          var disabled = used.indexOf(d.entityId) > -1 && d.entityId !== entity.entityId;
          return "<option value='" + d.entityId + "'" + (d.entityId === entity.entityId ? " selected" : "") + (disabled ? " disabled" : "") + ">" + d.entityId + "</option>";
        }).join("");

        body.innerHTML = ""
          + "<label class='form-item'>设备ID(entityId)<select class='input entity-input' data-index='" + index + "' data-field='entityId'>" + idOptions + "</select></label>"
          + "<label class='form-item'>设备类型(entityType)<select class='input entity-input' data-index='" + index + "' data-field='entityType'><option value='warningLight'" + (entity.entityType === "warningLight" ? " selected" : "") + ">warningLight</option><option value='broadcast'" + (entity.entityType === "broadcast" ? " selected" : "") + ">broadcast</option></select></label>"
          + "<label class='form-item'>触发时间(triggerAt)<input class='input entity-input' data-index='" + index + "' data-field='triggerAt' type='number' min='0' step='0.1' value='" + safeNumber(entity.triggerAt, 0) + "'></label>"
          + "<div></div>"
          + "<label class='form-item'>位置X<input class='input entity-input' data-index='" + index + "' data-field='positionX' type='number' value='" + safeNumber(entity.position[0], 0) + "'></label>"
          + "<label class='form-item'>位置Y<input class='input entity-input' data-index='" + index + "' data-field='positionY' type='number' value='" + safeNumber(entity.position[1], 0) + "'></label>"
          + "<label class='form-item'>位置Z<input class='input entity-input' data-index='" + index + "' data-field='positionZ' type='number' value='" + safeNumber(entity.position[2], 0) + "'></label>";

        if (entity.entityType === "broadcast") {
          body.innerHTML += ""
            + "<label class='form-item'>广播内容<input class='input entity-input' data-index='" + index + "' data-field='messageTemplate' type='text' value='" + (entity.config.messageTemplate || "") + "'></label>"
            + "<label class='form-item'>启用(enabled)<select class='input entity-input' data-index='" + index + "' data-field='enabled'><option value='true'" + (entity.config.enabled !== false ? " selected" : "") + ">true</option><option value='false'" + (entity.config.enabled === false ? " selected" : "") + ">false</option></select></label>"
            + "<label class='form-item'>作用半径(effectRadius)<input class='input entity-input' data-index='" + index + "' data-field='effectRadius' type='number' step='0.1' min='0' value='" + safeNumber(entity.config.effectRadius, 35) + "'></label>"
            + "<label class='form-item'>引导概率(guideBoostProb)<input class='input entity-input' data-index='" + index + "' data-field='guideBoostProb' type='number' step='0.01' min='0' max='1' value='" + safeNumber(entity.config.guideBoostProb, 0.18) + "'></label>";
        } else {
          body.innerHTML += ""
            + "<label class='form-item'>闪烁(blink)<select class='input entity-input' data-index='" + index + "' data-field='blink'><option value='true'" + (entity.config.blink !== false ? " selected" : "") + ">true</option><option value='false'" + (entity.config.blink === false ? " selected" : "") + ">false</option></select></label>"
            + "<label class='form-item'>作用半径(effectRadius)<input class='input entity-input' data-index='" + index + "' data-field='effectRadius' type='number' step='0.1' min='0' value='" + safeNumber(entity.config.effectRadius, 20) + "'></label>"
            + "<label class='form-item'>引导概率(guideBoostProb)<input class='input entity-input' data-index='" + index + "' data-field='guideBoostProb' type='number' step='0.01' min='0' max='1' value='" + safeNumber(entity.config.guideBoostProb, 0.12) + "'></label>";
        }
      } else {
        ensureMoveTarget(entity.config);
        body.innerHTML = ""
          + "<label class='form-item'>人员ID(entityId)<input class='input entity-input' data-index='" + index + "' data-field='entityId' type='text' value='" + (entity.entityId || "") + "'></label>"
          + "<label class='form-item'>人员类型(entityType)<select class='input entity-input' data-index='" + index + "' data-field='entityType'><option value='staffGuide'" + (entity.entityType === "staffGuide" ? " selected" : "") + ">staffGuide</option><option value='staffFire'" + (entity.entityType === "staffFire" ? " selected" : "") + ">staffFire</option></select></label>"
          + "<label class='form-item'>触发时间(triggerAt)<input class='input entity-input' data-index='" + index + "' data-field='triggerAt' type='number' min='0' step='0.1' value='" + safeNumber(entity.triggerAt, 0) + "'></label>"
          + "<div></div>"
          + "<label class='form-item'>位置X<input class='input entity-input' data-index='" + index + "' data-field='positionX' type='number' value='" + safeNumber(entity.position[0], 0) + "'></label>"
          + "<label class='form-item'>位置Y<input class='input entity-input' data-index='" + index + "' data-field='positionY' type='number' value='" + safeNumber(entity.position[1], 0) + "'></label>"
          + "<label class='form-item'>位置Z<input class='input entity-input' data-index='" + index + "' data-field='positionZ' type='number' value='" + safeNumber(entity.position[2], 0) + "'></label>"
          + "<label class='form-item'>到达动作(onArriveAction)<input class='input entity-input' data-index='" + index + "' data-field='onArriveAction' type='text' value='" + (entity.config.onArriveAction || "") + "'></label>"
          + "<label class='form-item'>目标X<input class='input entity-input' data-index='" + index + "' data-field='moveTargetX' type='number' value='" + safeNumber(entity.config.moveTarget[0], 0) + "'></label>"
          + "<label class='form-item'>目标Y<input class='input entity-input' data-index='" + index + "' data-field='moveTargetY' type='number' value='" + safeNumber(entity.config.moveTarget[1], 0) + "'></label>"
          + "<label class='form-item'>目标Z<input class='input entity-input' data-index='" + index + "' data-field='moveTargetZ' type='number' value='" + safeNumber(entity.config.moveTarget[2], 0) + "'></label>";

        if (entity.entityType === "staffFire") {
          body.innerHTML += ""
            + "<label class='form-item'>火势抑制(fireSpreadReduce)<input class='input entity-input' data-index='" + index + "' data-field='fireSpreadReduce' type='number' min='0' max='1' step='0.01' value='" + safeNumber(entity.config.fireSpreadReduce, 0.25) + "'></label>"
            + "<label class='form-item'>烟气抑制(gasSpreadReduce)<input class='input entity-input' data-index='" + index + "' data-field='gasSpreadReduce' type='number' min='0' max='1' step='0.01' value='" + safeNumber(entity.config.gasSpreadReduce, 0.2) + "'></label>";
        } else {
          body.innerHTML += ""
            + "<label class='form-item'>引导概率(guideBoostProb)<input class='input entity-input' data-index='" + index + "' data-field='guideBoostProb' type='number' min='0' max='1' step='0.01' value='" + safeNumber(entity.config.guideBoostProb, 0.2) + "'></label>";
        }
      }

      card.appendChild(head);
      card.appendChild(body);
      list.appendChild(card);
    });

    updateCreateTypeSelector();
  }

  function setEntityField(entity, field, value) {
    ensureEntityShape(entity);
    if (field === "entityId") {
      entity.entityId = String(value);
      if (entity.__kind === "device") {
        var meta = getDeviceMetaById(entity.entityId);
        if (meta) {
          entity.entityType = meta.entityType;
        }
      }
      return;
    }
    if (field === "entityType") {
      entity.entityType = String(value);
      if (entity.__kind === "device") {
        if (entity.entityType === "broadcast") {
          entity.config = {
            enabled: true,
            messageTemplate: entity.config.messageTemplate || "请沿A出口有序疏散",
            effectRadius: safeNumber(entity.config.effectRadius, 35),
            guideBoostProb: safeNumber(entity.config.guideBoostProb, 0.18)
          };
        } else {
          entity.config = {
            blink: entity.config.blink !== false,
            effectRadius: safeNumber(entity.config.effectRadius, 20),
            guideBoostProb: safeNumber(entity.config.guideBoostProb, 0.12)
          };
        }
      }
      if (entity.__kind === "staff") {
        ensureMoveTarget(entity.config);
        if (entity.entityType === "staffFire") {
          entity.config.onArriveAction = entity.config.onArriveAction || "extinguish";
        } else {
          entity.config.onArriveAction = entity.config.onArriveAction || "evacuate";
        }
      }
      return;
    }
    if (field === "triggerAt") {
      entity.triggerAt = safeNumber(value, 0);
      return;
    }
    if (field === "positionX") {
      entity.position[0] = safeNumber(value, 0);
      return;
    }
    if (field === "positionY") {
      entity.position[1] = safeNumber(value, 0);
      return;
    }
    if (field === "positionZ") {
      entity.position[2] = safeNumber(value, 0);
      return;
    }

    if (field === "blink") {
      entity.config.blink = String(value) === "true";
      return;
    }
    if (field === "enabled") {
      entity.config.enabled = String(value) === "true";
      return;
    }
    if (field === "messageTemplate") {
      entity.config.messageTemplate = String(value);
      return;
    }
    if (field === "effectRadius") {
      entity.config.effectRadius = safeNumber(value, 0);
      return;
    }
    if (field === "guideBoostProb") {
      entity.config.guideBoostProb = safeNumber(value, 0);
      return;
    }
    if (field === "onArriveAction") {
      entity.config.onArriveAction = String(value);
      return;
    }
    if (field === "moveTargetX") {
      ensureMoveTarget(entity.config);
      entity.config.moveTarget[0] = safeNumber(value, 0);
      return;
    }
    if (field === "moveTargetY") {
      ensureMoveTarget(entity.config);
      entity.config.moveTarget[1] = safeNumber(value, 0);
      return;
    }
    if (field === "moveTargetZ") {
      ensureMoveTarget(entity.config);
      entity.config.moveTarget[2] = safeNumber(value, 0);
      return;
    }
    if (field === "fireSpreadReduce") {
      entity.config.fireSpreadReduce = safeNumber(value, 0);
      return;
    }
    if (field === "gasSpreadReduce") {
      entity.config.gasSpreadReduce = safeNumber(value, 0);
    }
  }

  function setupCreateModalEvents() {
    var waterToggle = $("cfg-water-enabled");
    var fireToggle = $("cfg-fire-enabled");
    var waterParams = $("water-params");
    var fireParams = $("fire-params");
    var randScenarioBtn = $("btn-rand-scenario");
    var addEntityBtn = $("add-special-entity");
    var entityTypeSel = $("sel-entity-type");
    var entityList = $("special-entity-list");

    function refreshDisasterPanels() {
      if (waterParams) {
        waterParams.classList.toggle("show", !!(waterToggle && waterToggle.checked));
      }
      if (fireParams) {
        fireParams.classList.toggle("show", !!(fireToggle && fireToggle.checked));
      }
    }

    if (waterToggle) {
      waterToggle.addEventListener("change", refreshDisasterPanels);
    }
    if (fireToggle) {
      fireToggle.addEventListener("change", refreshDisasterPanels);
    }

    if (randScenarioBtn) {
      randScenarioBtn.addEventListener("click", function () {
        var input = $("cfg-scenario-id");
        if (input) {
          input.value = randomScenarioId();
        }
      });
    }

    if (addEntityBtn && entityTypeSel) {
      addEntityBtn.addEventListener("click", function () {
        updateCreateTypeSelector();
        entityTypeSel.style.display = "";
        entityTypeSel.value = "";
        entityTypeSel.focus();
      });

      entityTypeSel.addEventListener("change", function () {
        if (!entityTypeSel.value) {
          return;
        }
        if (entityTypeSel.value === "device" && getUsedDeviceIds().length >= DEVICE_CATALOG.length) {
          addLog("device 数量已达上限", "warn");
          entityTypeSel.value = "";
          return;
        }
        state.createEntities.push(createDefaultEntity(entityTypeSel.value));
        renderSpecialEntities();
        entityTypeSel.value = "";
        entityTypeSel.style.display = "none";
      });
    }

    if (entityList) {
      entityList.addEventListener("click", function (e) {
        var action = e.target && e.target.getAttribute("data-action");
        if (action !== "remove") {
          return;
        }
        var idx = safeNumber(e.target.getAttribute("data-index"), -1);
        if (idx < 0 || idx >= state.createEntities.length) {
          return;
        }
        state.createEntities.splice(idx, 1);
        renderSpecialEntities();
      });

      entityList.addEventListener("change", function (e) {
        var target = e.target;
        if (!target || !target.classList.contains("entity-input")) {
          return;
        }
        var idx = safeNumber(target.getAttribute("data-index"), -1);
        var field = target.getAttribute("data-field");
        if (idx < 0 || idx >= state.createEntities.length || !field) {
          return;
        }
        setEntityField(state.createEntities[idx], field, target.value);
        renderSpecialEntities();
      });
    }

    refreshDisasterPanels();
    updateCreateTypeSelector();
    renderSpecialEntities();
  }

  function buildCreatePayload() {
    var waterEnabled = !!($("cfg-water-enabled") && $("cfg-water-enabled").checked);
    var fireEnabled = !!($("cfg-fire-enabled") && $("cfg-fire-enabled").checked);

    var payload = {
      scenarioId: $("cfg-scenario-id").value.trim() || randomScenarioId(),
      mapLevel: $("cfg-map-level").value.trim() || "Station_A_Platform",
      totalPeople: safeNumber($("cfg-total-people").value, 500),
      seed: safeNumber($("cfg-seed") ? $("cfg-seed").value : "", Date.now() % 100000),
      disasters: {
        water: {
          enabled: waterEnabled,
          inlets: waterEnabled ? [
            {
              inletId: $("cfg-water-inlet-id").value.trim() || "water_inlet_01",
              zoneId: $("cfg-water-zone-id").value.trim() || "zone_entrance_02",
              position: [
                safeNumber($("cfg-water-pos-x").value, 1200),
                safeNumber($("cfg-water-pos-y").value, -500),
                safeNumber($("cfg-water-pos-z").value, 20)
              ],
              inflowRate: safeNumber($("cfg-water-rate").value, 50),
              totalVolume: safeNumber($("cfg-water-vol").value, 12000),
              startAt: safeNumber($("cfg-water-start-at").value, 0),
              duration: safeNumber($("cfg-water-duration").value, 240)
            }
          ] : []
        },
        fire: {
          enabled: fireEnabled,
          sources: fireEnabled ? [
            {
              fireId: $("cfg-fire-id").value.trim() || "fire_src_01",
              position: [
                safeNumber($("cfg-fire-pos-x").value, 1080),
                safeNumber($("cfg-fire-pos-y").value, -460),
                safeNumber($("cfg-fire-pos-z").value, 100)
              ],
              spreadSpeed: safeNumber($("cfg-fire-speed").value, 1.2),
              fireType: $("cfg-fire-type").value || "electric",
              gasType: $("cfg-fire-gas-type").value || "toxicSmoke",
              gasSpreadSpeed: safeNumber($("cfg-fire-gas-speed").value, 1.8),
              initialConcentration: safeNumber($("cfg-fire-init-concentration").value, 0.35),
              startAt: safeNumber($("cfg-fire-start-at").value, 0)
            }
          ] : []
        }
      },
      specialEntities: state.createEntities.map(function (entity) {
        return {
          entityId: entity.entityId,
          entityType: entity.entityType,
          position: Array.isArray(entity.position) ? entity.position.slice(0, 3) : [0, 0, 0],
          triggerAt: safeNumber(entity.triggerAt, 0),
          config: entity.config || {}
        };
      }),
      ext: {}
    };

    var extInput = $("cfg-extra");
    if (extInput) {
      var extText = extInput.value.trim();
      if (extText) {
        payload.ext = JSON.parse(extText);
      }
    }

    return payload;
  }

  function connectMiddleware() {
    var middlewareUrl = $("middleware-url").value.trim() || "http://127.0.0.1:3100";
    var socketUrl = $("socket-url").value.trim() || middlewareUrl;

    global.MiddlewareClient.setBaseUrls(middlewareUrl, socketUrl);

    fetch(middlewareUrl.replace(/\/$/, "") + "/healthz", { method: "GET" })
      .then(function (resp) {
        if (!resp.ok) {
          throw new Error("status=" + resp.status);
        }
        return resp.json();
      })
      .then(function () {
        state.middlewareConnected = true;
        updateTopbar();
      })
      .catch(function (err) {
        state.middlewareConnected = false;
        updateTopbar();
        addLog("中台HTTP不可用: " + err.message, "error");
      });

    global.MiddlewareClient.connectSocket(function (eventName, envelope) {
      if (eventName === "UpdateFrame") {
        onFrameUpdate(envelope);
      } else if (eventName === "SimState") {
        onSimState(envelope);
      } else if (eventName === "Ack") {
        onAck(envelope);
      }
    });

    var socket = global.MiddlewareClient.getState().socket;
    if (socket) {
      socket.on("connect", function () {
        state.socketConnected = true;
        updateTopbar();
      });
      socket.on("disconnect", function () {
        state.socketConnected = false;
        updateTopbar();
      });
      socket.on("connect_error", function () {
        state.socketConnected = false;
        updateTopbar();
      });
    }

    addLog("已发起中台连接", "info");
  }

  function connectStreaming() {
    if (typeof global.load === "function" && !state.bootstrapped) {
      global.load();
      state.bootstrapped = true;
    }

    if (typeof global.connect === "function") {
      global.connect();
      addLog("已发起Pixel Streaming连接", "info");
    } else {
      addLog("未检测到connect函数，跳过流连接", "warn");
    }
  }

  function bindEvents() {
    $("sidebar-toggle").addEventListener("click", function () {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      $("sidebar").classList.toggle("collapsed", state.sidebarCollapsed);
    });

    $("btn-create").addEventListener("click", function () {
      if (!$("cfg-scenario-id").value.trim()) {
        $("cfg-scenario-id").value = randomScenarioId();
      }
      $("create-modal").classList.add("show");
      $("btn-create").classList.add("active");
    });

    $("btn-history").addEventListener("click", function () {
      global.open("/history.html", "_blank");
    });

    $("btn-plan").addEventListener("click", function () {
      $("plan-modal").classList.add("show");
      $("btn-plan").classList.add("active");
    });

    $("btn-analysis").addEventListener("click", function () {
      state.analysisVisible = !state.analysisVisible;
      $("analysis-panel").classList.toggle("hidden", !state.analysisVisible);
      $("btn-analysis").classList.toggle("active", state.analysisVisible);
    });

    $("close-create").addEventListener("click", function () {
      $("create-modal").classList.remove("show");
      $("btn-create").classList.remove("active");
    });

    $("close-plan").addEventListener("click", function () {
      $("plan-modal").classList.remove("show");
      $("btn-plan").classList.remove("active");
    });

    $("connect-all").addEventListener("click", function () {
      connectMiddleware();
      connectStreaming();
    });

    $("start-mock-sim").addEventListener("click", function () {
      if (!state.simulationId) {
        addLog("请先创建或输入仿真ID", "warn");
        return;
      }

      setAck("pending", "正在触发模拟后端");
      global.MiddlewareClient.startIntegrationBackend(state.simulationId, {
        fps: 2,
        totalFrames: 30,
        randomMode: false
      })
        .then(function () {
          state.mockPlayableNotifiedFor = "";
          setAck("ok", "模拟后端已启动");
          addLog("已触发模拟后端，等待帧回写", "ok");
          readSimulationInfo(state.simulationId);
          startMockProgressProbe(state.simulationId);
        })
        .catch(function (err) {
          clearMockProgressProbe();
          setAck("error", "模拟后端触发失败");
          addLog("触发模拟后端失败: " + err.message, "error");
        });
    });

    $("btn-play").addEventListener("click", function () {
      try {
        global.MiddlewareClient.emitPlay();
        setAck("pending", "播放命令已发送");
      } catch (err) {
        setAck("error", "播放失败");
        addLog("播放失败: " + err.message, "error");
      }
    });

    $("btn-pause").addEventListener("click", function () {
      try {
        global.MiddlewareClient.emitPause();
        setAck("pending", "暂停命令已发送");
      } catch (err) {
        setAck("error", "暂停失败");
      }
    });

    $("step-size").addEventListener("change", function (e) {
      state.stepFrames = safeNumber(e.target.value, 1);
    });

    $("btn-back").addEventListener("click", function () {
      stepSeek(-state.stepFrames);
    });

    $("btn-forward").addEventListener("click", function () {
      stepSeek(state.stepFrames);
    });

    $("timeline-slider").addEventListener("input", function (e) {
      state.currentFrameIndex = safeNumber(e.target.value, state.currentFrameIndex);
      syncTimelineView();
    });

    $("timeline-slider").addEventListener("change", function (e) {
      var index = safeNumber(e.target.value, state.currentFrameIndex);
      seekByFrame(index);
    });

    $("save-create").addEventListener("click", function () {
      try {
        var payload = buildCreatePayload();
        global.MiddlewareClient.createSimulation(payload)
          .then(function (res) {
            var simId = res && res.payload ? res.payload.simulationId : "";
            if (!simId) {
              throw new Error("返回缺少simulationId");
            }

            state.simulationId = simId;
            state.completionNotifiedFor = "";
            state.mockPlayableNotifiedFor = "";
            clearMockProgressProbe();
            global.MiddlewareClient.setSimulationId(simId);
            $("input-simulation-id").value = simId;
            $("create-modal").classList.remove("show");
            $("btn-create").classList.remove("active");
            setAck("ok", "仿真已创建");
            readSimulationInfo(simId);
            addLog("创建仿真成功: " + simId, "ok");
            updateTopbar();
          })
          .catch(function (err) {
            setAck("error", "创建仿真失败");
            addLog("创建仿真失败: " + err.message, "error");
          });
      } catch (err) {
        addLog("创建仿真扩展JSON格式错误", "error");
        setAck("error", "创建参数错误");
      }
    });

    $("save-plan").addEventListener("click", function () {
      if (!state.simulationId) {
        addLog("请先创建或选择仿真，再创建预案", "warn");
        return;
      }

      var fromSimTime = safeNumber($("plan-from-time").value, 0);
      var objective = $("plan-objective").value.trim() || "优化疏散效率";
      var body = {
        fromSimulationId: state.simulationId,
        fromSimTime: fromSimTime,
        planSource: "llm",
        objective: objective,
        initConfigLike: {
          disasters: undefined,
          specialEntities: []
        },
        planRuntime: {
          actions: []
        }
      };

      try {
        var text = $("plan-json").value.trim();
        if (text) {
          var parsed = JSON.parse(text);
          Object.assign(body, parsed);
        }
      } catch (err) {
        addLog("预案JSON格式错误", "error");
        return;
      }

      global.MiddlewareClient.requestIntegrationPlan({
        fromSimulationId: state.simulationId,
        fromSimTime: fromSimTime,
        objective: objective,
        context: body.context || {},
        initConfigLike: body.initConfigLike || {}
      })
        .then(function (res) {
          var planId = res && res.payload ? res.payload.planId : "";
          if (!planId) {
            throw new Error("返回缺少planId");
          }
          return global.MiddlewareClient.applyPlan(planId, { fromSimTime: fromSimTime });
        })
        .then(function () {
          $("plan-modal").classList.remove("show");
          $("btn-plan").classList.remove("active");
          setAck("ok", "预案已应用");
          addLog("预案生成并应用完成", "ok");
        })
        .catch(function (err) {
          setAck("error", "预案应用失败");
          addLog("预案流程失败: " + err.message, "error");
        });
    });

    $("subscribe-sim").addEventListener("click", function () {
      var simId = $("input-simulation-id").value.trim();
      if (!simId) {
        addLog("请输入simulationId", "warn");
        return;
      }
      state.simulationId = simId;
      clearMockProgressProbe();
      global.MiddlewareClient.setSimulationId(simId);
      global.MiddlewareClient.socketSubscribe(simId);
      readSimulationInfo(simId);
      updateTopbar();
      addLog("已订阅仿真: " + simId, "ok");
    });
  }

  function setupPolling() {
    setInterval(function () {
      updateTopbar();
    }, 1000);
  }

  function initLegacyDom() {
    var keep = [
      "overlayButton",
      "enlarge-display-to-fill-window-tgl",
      "quality-control-ownership-tgl",
      "prioritise-quality-tgl",
      "quality-params-submit",
      "low-bitrate-text",
      "high-bitrate-text",
      "min-fps-text",
      "show-fps-button",
      "match-viewport-res-tgl",
      "show-stats-tgl",
      "kick-other-players-button",
      "statsContainer",
      "overlay"
    ];

    keep.forEach(function (id) {
      if ($(id)) {
        return;
      }
      var node;
      if (id.indexOf("-tgl") > -1) {
        node = document.createElement("input");
        node.type = "checkbox";
      } else if (id.indexOf("-text") > -1) {
        node = document.createElement("input");
        node.type = "text";
        node.value = "0";
      } else {
        node = document.createElement("button");
        node.type = "button";
      }
      node.id = id;
      $("legacy-hidden").appendChild(node);
    });
  }

  function init() {
    console.log('[AppShell] Initializing...');
    initLegacyDom();
    bindEvents();
    setupCreateModalEvents();
    setupPolling();
    syncTimelineView();
    updateTopbar();
    addLog("Page loaded, click Connect All to start", "info");
    console.log('[AppShell] Initialization complete');
  }

  // Fix: DOMContentLoaded may have already fired when this script loads
  if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    // DOM already loaded, run init immediately
    init();
  }
})(window);
