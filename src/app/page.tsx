import { ChatContainer } from "@/components/ChatContainer/ChatContainer";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <ChatContainer />
    </main>
  );
}
