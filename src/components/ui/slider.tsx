"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type SliderProps = {
  className?: string;
  defaultValue?: number[];
  value?: number[];
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number[]) => void;
};

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
}: SliderProps) {
  const initial = Array.isArray(value)
    ? value[0]
    : Array.isArray(defaultValue)
      ? defaultValue[0]
      : min;

  const [internal, setInternal] = React.useState<number>(initial);
  const current = Array.isArray(value) ? value[0] : internal;

  React.useEffect(() => {
    if (Array.isArray(value)) {
      setInternal(value[0]);
    }
  }, [value]);

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={current}
      onChange={(event) => {
        const next = Number(event.target.value);
        setInternal(next);
        onValueChange?.([next]);
      }}
      className={cn("w-full accent-blue-600", className)}
    />
  );
}

export { Slider };
