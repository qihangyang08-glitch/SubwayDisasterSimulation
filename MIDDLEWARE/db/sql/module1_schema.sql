-- Module 1 schema for Digital Twin Metro Emergency Simulation
-- MySQL 8.0+

CREATE TABLE IF NOT EXISTS simulations (
  sim_id VARCHAR(64) NOT NULL,
  scenario_id VARCHAR(128) NOT NULL,
  map_level VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'running',
  init_config JSON NOT NULL,
  created_at BIGINT UNSIGNED NOT NULL,
  finished_at BIGINT UNSIGNED NULL,
  PRIMARY KEY (sim_id),
  CONSTRAINT chk_simulations_init_config_json CHECK (JSON_VALID(init_config))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS simulation_frames (
  sim_id VARCHAR(64) NOT NULL,
  frame_index INT UNSIGNED NOT NULL,
  sim_time DECIMAL(12,3) NOT NULL,
  frame_snapshot JSON NOT NULL,
  created_at BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (sim_id, frame_index),
  KEY idx_simulation_frames_sim_time (sim_id, sim_time),
  CONSTRAINT fk_simulation_frames_sim_id
    FOREIGN KEY (sim_id)
    REFERENCES simulations(sim_id)
    ON DELETE CASCADE
    ON UPDATE RESTRICT,
  CONSTRAINT chk_simulation_frames_snapshot_json CHECK (JSON_VALID(frame_snapshot))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS plans (
  plan_id VARCHAR(64) NOT NULL,
  from_simulation_id VARCHAR(64) NOT NULL,
  from_sim_time DECIMAL(12,3) NOT NULL,
  plan_source VARCHAR(16) NOT NULL,
  plan_config JSON NOT NULL,
  created_at BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (plan_id),
  KEY idx_plans_from_simulation_id (from_simulation_id),
  CONSTRAINT fk_plans_from_simulation_id
    FOREIGN KEY (from_simulation_id)
    REFERENCES simulations(sim_id)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT,
  CONSTRAINT chk_plans_plan_config_json CHECK (JSON_VALID(plan_config))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS plan_runs (
  plan_run_id VARCHAR(64) NOT NULL,
  base_simulation_id VARCHAR(64) NOT NULL,
  plan_id VARCHAR(64) NOT NULL,
  new_simulation_id VARCHAR(64) NOT NULL,
  created_at BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (plan_run_id),
  UNIQUE KEY uk_plan_runs_base_plan_new (base_simulation_id, plan_id, new_simulation_id),
  KEY idx_plan_runs_base_sim_created_at (base_simulation_id, created_at),
  CONSTRAINT fk_plan_runs_base_simulation_id
    FOREIGN KEY (base_simulation_id)
    REFERENCES simulations(sim_id)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT,
  CONSTRAINT fk_plan_runs_plan_id
    FOREIGN KEY (plan_id)
    REFERENCES plans(plan_id)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT,
  CONSTRAINT fk_plan_runs_new_simulation_id
    FOREIGN KEY (new_simulation_id)
    REFERENCES simulations(sim_id)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
