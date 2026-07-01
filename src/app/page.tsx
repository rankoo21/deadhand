"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChamberWorld } from "@/components/chamber/ChamberWorld";
import { Antechamber } from "@/components/stations/Antechamber";
import { SealingTable } from "@/components/stations/SealingTable";
import { BindingAltar } from "@/components/stations/BindingAltar";
import { VaultHall } from "@/components/stations/VaultHall";
import { TheMelt } from "@/components/stations/TheMelt";
import { KeepersLedger } from "@/components/stations/KeepersLedger";
import { useChamberStore } from "@/store/useChamberStore";

// The whole chamber is a single candlelit space. Each station cross-fades in
// place so the experience feels like moving through one room, not clicking tabs.
export default function Page() {
  const reduced = useReducedMotion();
  const station = useChamberStore((s) => s.station);

  return (
    <ChamberWorld>
      <AnimatePresence mode="wait">
        <motion.div
          key={station}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.15 : 0.55 }}
        >
          {station === "antechamber" && <Antechamber />}
          {station === "table" && <SealingTable />}
          {station === "altar" && <BindingAltar />}
          {station === "hall" && <VaultHall />}
          {station === "melt" && <TheMelt />}
          {station === "ledger" && <KeepersLedger />}
        </motion.div>
      </AnimatePresence>
    </ChamberWorld>
  );
}
