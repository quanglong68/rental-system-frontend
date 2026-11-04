import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "@/shared/ui";

/** Toast nổi cho giao diện khách hàng (Customer Portal) */
export function useCxToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const show = (m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg(null), 2600);
  };
  const node = (
    <AnimatePresence>
      {msg && (
        <motion.div
          className="cx-toast"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
        >
          <Icon name="check" size={16} />
          {msg}
        </motion.div>
      )}
    </AnimatePresence>
  );
  return [node, show] as const;
}
