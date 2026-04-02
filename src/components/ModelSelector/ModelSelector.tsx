"use client";

import { ModelConfig } from "@/types";
import styles from "./ModelSelector.module.css";

interface ModelSelectorProps {
  models: ModelConfig[];
  selectedModels: string[];
  onToggleModel: (modelId: string) => void;
  disabled: boolean;
}

export function ModelSelector({ models, selectedModels, onToggleModel, disabled }: ModelSelectorProps) {
  return (
    <div className={styles.selector}>
      {models.map((model) => (
        <label key={model.id} className={styles.label}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={selectedModels.includes(model.id)}
            onChange={() => onToggleModel(model.id)}
            disabled={disabled}
          />
          {model.name}
        </label>
      ))}
    </div>
  );
}
