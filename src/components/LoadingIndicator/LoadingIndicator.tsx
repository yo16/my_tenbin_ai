import styles from "./LoadingIndicator.module.css";

interface LoadingIndicatorProps {
  modelName: string;
}

export function LoadingIndicator({ modelName }: LoadingIndicatorProps) {
  return (
    <div className={styles.loading}>
      {modelName} が考え中
      <span className={styles.dots}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </span>
    </div>
  );
}
