"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CallController } from "./call-controller";

export function useVoiceCall() {
  const [controller] = useState(() => new CallController());
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);

  useEffect(() => () => controller.dispose(), [controller]);

  return { ...snapshot, controller, levels: controller.levels };
}
