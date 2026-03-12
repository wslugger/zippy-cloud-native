"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type SelectContextValue = {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
};

const SelectContext = React.createContext<SelectContextValue>({});

type SelectRootProps = {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
};

function Select({ value, onValueChange, children }: SelectRootProps) {
  const trigger = React.Children.toArray(children).find(
    (child) => React.isValidElement(child) && child.type === SelectTrigger
  );
  const content = React.Children.toArray(children).find(
    (child) => React.isValidElement(child) && child.type === SelectContent
  );

  const options: Array<{ value: string; label: string; disabled?: boolean }> = [];
  if (React.isValidElement<{ children?: React.ReactNode }>(content)) {
    React.Children.forEach(content.props.children, (child) => {
      if (React.isValidElement<{ value: string; children?: React.ReactNode; disabled?: boolean }>(child) && child.type === SelectItem) {
        options.push({
          value: child.props.value,
          label: typeof child.props.children === "string" ? child.props.children : String(child.props.value),
          disabled: Boolean(child.props.disabled),
        });
      }
    });
  }

  let placeholder: string | undefined;
  if (React.isValidElement<{ children?: React.ReactNode }>(trigger)) {
    const selectValue = React.Children.toArray(trigger.props.children).find(
      (child) => React.isValidElement(child) && child.type === SelectValue
    );
    if (selectValue) {
      placeholder = (selectValue as React.ReactElement<{ placeholder?: string }>).props.placeholder;
    }
  }

  return (
    <SelectContext.Provider value={{ value, onValueChange, placeholder }}>
      <select
        value={value ?? ""}
        onChange={(event) => onValueChange?.(event.target.value)}
        className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </SelectContext.Provider>
  );
}

function SelectTrigger({
  className,
  children,
}: {
  id?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return <div className={cn(className)}>{children}</div>;
}

function SelectValue({ placeholder }: { placeholder?: string }) {
  const context = React.useContext(SelectContext);
  return <span data-placeholder={context.value ? undefined : true}>{context.value || placeholder || ""}</span>;
}

function SelectContent({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function SelectItem({
  value,
  children,
  disabled,
}: {
  value: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <option value={value} disabled={disabled}>
      {children}
    </option>
  );
}

function SelectGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function SelectLabel({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function SelectSeparator() {
  return null;
}

function SelectScrollUpButton() {
  return null;
}

function SelectScrollDownButton() {
  return null;
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
