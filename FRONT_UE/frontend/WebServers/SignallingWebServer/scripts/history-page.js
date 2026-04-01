(function (global) {
  var state = {
    selectedSimulationId: "",
    simulations: [],
    rows: []
  };

  var METRIC_OPTIONS = [
    { key: "simTime", label: "simTime" },
    { key: "frameIndex", label: "frameIndex" },
    { key: "totalEvacuated", label: "statistics.totalEvacuated" },
    { key: "casualtyCount", label: "statistics.casualtyCount" },
    { key: "inWaterDeep", label: "statistics.inWaterDeep" },
    { key: "avgExposureTime", label: "statistics.avgExposureTime" },
    { key: "zoneMaxWaterLevel", label: "environment.zones[].waterLevel(max)" },
    { key: "zoneMaxFireIntensity", label: "environment.zones[].fireIntensity(max)" },
    { key: "zoneMaxSmokeDensity", label: "environment.zones[].smokeDensity(max)" },
    { key: "zoneMaxGasConcentration", label: "environment.zones[].gasConcentration(max)" },
    { key: "agentCount", label: "agents.length" },
    { key: "agentAvgPanicLevel", label: "agents[].panicLevel(avg)" },
    { key: "activeEntityCount", label: "specialEntities[state=active].count" }
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(text) {
    var el = $("history-status");
    if (el) {
      el.textContent = text;
    }
  }

  function safeNumber(v, fallback) {
    var n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function formatTime(v) {
    return safeNumber(v, 0).toFixed(2);
  }

  function maxFrom(arr, key) {
    var values = (arr || []).map(function (it) { return safeNumber(it[key], 0); });
    if (!values.length) {
      return 0;
    }
    return Math.max.apply(Math, values);
  }

  function avgFrom(arr, key) {
    var list = (arr || []).map(function (it) { return Number(it[key]); }).filter(function (n) { return Number.isFinite(n); });
    if (!list.length) {
      return 0;
    }
    var sum = list.reduce(function (acc, n) { return acc + n; }, 0);
    return sum / list.length;
  }

  function extractRow(frame) {
    var statistics = frame.statistics || {};
    var zones = frame.environment && Array.isArray(frame.environment.zones) ? frame.environment.zones : [];
    var agents = Array.isArray(frame.agents) ? frame.agents : [];
    var entities = Array.isArray(frame.specialEntities) ? frame.specialEntities : [];

    return {
      simTime: safeNumber(frame.simTime, 0),
      frameIndex: safeNumber(frame.frameIndex, 0),
      totalEvacuated: safeNumber(statistics.totalEvacuated, 0),
      casualtyCount: safeNumber(statistics.casualtyCount, 0),
      inWaterDeep: safeNumber(statistics.inWaterDeep, 0),
      avgExposureTime: safeNumber(statistics.avgExposureTime, 0),
      zoneMaxWaterLevel: maxFrom(zones, "waterLevel"),
      zoneMaxFireIntensity: maxFrom(zones, "fireIntensity"),
      zoneMaxSmokeDensity: maxFrom(zones, "smokeDensity"),
      zoneMaxGasConcentration: maxFrom(zones, "gasConcentration"),
      agentCount: agents.length,
      agentAvgPanicLevel: avgFrom(agents, "panicLevel"),
      activeEntityCount: entities.filter(function (e) { return e && e.state === "active"; }).length
    };
  }

  function renderSimulationList() {
    var container = $("sim-list");
    var count = $("sim-count");
    container.innerHTML = "";

    if (count) {
      count.textContent = state.simulations.length + " 条";
    }

    if (!state.simulations.length) {
      container.innerHTML = '<div class="empty">暂无仿真历史记录</div>';
      return;
    }

    state.simulations.forEach(function (sim) {
      var item = document.createElement("button");
      item.type = "button";
      item.className = "sim-item" + (sim.simulationId === state.selectedSimulationId ? " active" : "");
      item.innerHTML = ""
        + '<div class="sim-id">' + sim.simulationId + "</div>"
        + '<div class="sim-meta">场景: ' + (sim.scenarioId || "-") + "</div>"
        + '<div class="sim-meta">状态: ' + (sim.status || "-") + "</div>"
        + '<div class="sim-meta">创建: ' + new Date(sim.createdAt).toLocaleString() + "</div>";
      item.addEventListener("click", function () {
        loadTimeline(sim.simulationId);
      });
      container.appendChild(item);
    });
  }

  function renderTimelineRows() {
    var tbody = $("timeline-body");
    tbody.innerHTML = "";

    if (!state.rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">当前仿真暂无可展示帧数据</td></tr>';
      return;
    }

    state.rows
      .sort(function (a, b) { return a.simTime - b.simTime; })
      .forEach(function (row) {
        var tr = document.createElement("tr");
        tr.innerHTML = ""
          + "<td>" + formatTime(row.simTime) + "</td>"
          + "<td>" + row.frameIndex + "</td>"
          + "<td>" + row.totalEvacuated + "</td>"
          + "<td>" + row.zoneMaxWaterLevel.toFixed(3) + "</td>"
          + "<td>" + row.zoneMaxFireIntensity.toFixed(3) + "</td>"
          + "<td>" + row.agentCount + "</td>"
          + "<td>" + row.activeEntityCount + "</td>";
        tbody.appendChild(tr);
      });
  }

  function renderAxisOptions() {
    var xSelect = $("line-x-axis");
    var yContainer = $("line-y-axis");

    xSelect.innerHTML = METRIC_OPTIONS.map(function (option) {
      return '<option value="' + option.key + '">' + option.label + "</option>";
    }).join("");

    yContainer.innerHTML = METRIC_OPTIONS.map(function (option, idx) {
      var checked = idx > 1 && idx < 5;
      return ""
        + '<label class="y-axis-item">'
        + '<input type="checkbox" class="line-y-item" value="' + option.key + '"' + (checked ? " checked" : "") + ">"
        + "<span>" + option.label + "</span>"
        + "</label>";
    }).join("");
  }

  function updateAnalysisPlaceholder() {
    var type = $("analysis-type").value;
    var lineCfg = $("line-config");
    var box = $("analysis-placeholder");

    if (type !== "line") {
      lineCfg.style.display = "none";
      box.textContent = "已选择“" + type + "”。该类型已预留接口与交互占位，后续可接入真实绘图引擎与分析逻辑。";
      return;
    }

    lineCfg.style.display = "grid";
    var x = $("line-x-axis").value;
    var y = Array.prototype.slice.call(document.querySelectorAll(".line-y-item:checked")).map(function (it) {
      return it.value;
    });

    if (!y.length) {
      box.textContent = "曲线图演示: 请至少选择一个纵轴字段。当前仅演示配置流程，不执行真实绘图。";
      return;
    }

    box.textContent = "曲线图演示: 横轴 = " + x + "，纵轴 = [" + y.join(", ") + "]。当前页面仅展示操作链路，绘图功能后续接入。";
  }

  function createSampleTimes(minSimTime, maxSimTime, sampleCount) {
    var min = safeNumber(minSimTime, 0);
    var max = safeNumber(maxSimTime, min);

    if (max <= min) {
      return [min];
    }

    var step = (max - min) / (sampleCount - 1);
    var times = [];
    for (var i = 0; i < sampleCount; i += 1) {
      times.push(min + step * i);
    }
    return times;
  }

  function loadTimeline(simulationId) {
    if (!simulationId) {
      return;
    }

    state.selectedSimulationId = simulationId;
    renderSimulationList();
    setStatus("正在加载时间序列: " + simulationId);

    $("timeline-title").textContent = "时间顺序数据列 - " + simulationId;
    $("timeline-desc").textContent = "按 simTime 升序展示采样帧（演示用）";

    global.MiddlewareClient.getSimulationInfo(simulationId)
      .then(function (info) {
        var payload = info && info.payload ? info.payload : {};
        var times = createSampleTimes(payload.minSimTime, payload.maxSimTime, 24);

        return Promise.all(times.map(function (t) {
          return global.MiddlewareClient.getFrameByTime(simulationId, t)
            .then(function (res) {
              return res && res.payload ? res.payload : null;
            })
            .catch(function () {
              return null;
            });
        }));
      })
      .then(function (frames) {
        state.rows = frames
          .filter(function (f) { return !!f; })
          .map(extractRow);

        renderTimelineRows();
        updateAnalysisPlaceholder();
        setStatus("已加载 " + state.rows.length + " 条时间序列帧");
      })
      .catch(function (err) {
        state.rows = [];
        renderTimelineRows();
        setStatus("时间序列加载失败: " + (err && err.message ? err.message : "unknown"));
      });
  }

  function loadSimulations() {
    setStatus("正在加载仿真历史列表...");
    global.MiddlewareClient.listSimulations()
      .then(function (res) {
        var payload = res && res.payload ? res.payload : {};
        state.simulations = Array.isArray(payload.simulations) ? payload.simulations : [];
        renderSimulationList();

        if (!state.simulations.length) {
          setStatus("当前没有可用的仿真历史记录");
          return;
        }

        setStatus("仿真历史加载完成");
        loadTimeline(state.simulations[0].simulationId);
      })
      .catch(function (err) {
        state.simulations = [];
        renderSimulationList();
        setStatus("列表加载失败: " + (err && err.message ? err.message : "unknown"));
      });
  }

  function bindEvents() {
    $("btn-open-analysis").addEventListener("click", function () {
      $("analysis-panel").classList.toggle("hidden");
    });

    $("btn-close-analysis").addEventListener("click", function () {
      $("analysis-panel").classList.add("hidden");
    });

    $("btn-refresh-sims").addEventListener("click", function () {
      loadSimulations();
    });

    $("analysis-type").addEventListener("change", updateAnalysisPlaceholder);
    $("line-x-axis").addEventListener("change", updateAnalysisPlaceholder);
    $("line-y-axis").addEventListener("change", function (e) {
      if (e.target && e.target.classList.contains("line-y-item")) {
        updateAnalysisPlaceholder();
      }
    });
  }

  function init() {
    renderAxisOptions();
    bindEvents();
    updateAnalysisPlaceholder();
    loadSimulations();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);
