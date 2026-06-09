"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DateTimePickerProps {
  value: string; // ISO string or ""
  onChange: (value: string) => void;
  placeholder?: string;
}

export function DateTimePicker({ value, onChange, placeholder = "Pick date & time" }: DateTimePickerProps) {
  const date = value ? new Date(value) : undefined;
  const timeStr = date ? format(date, "HH:mm") : "";

  const handleDateSelect = (selected: Date | undefined) => {
    if (!selected) return;
    const hours = date ? date.getHours() : 0;
    const minutes = date ? date.getMinutes() : 0;
    selected.setHours(hours, minutes, 0, 0);
    // Format as datetime-local value: YYYY-MM-DDTHH:mm
    onChange(format(selected, "yyyy-MM-dd'T'HH:mm"));
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [hours, minutes] = e.target.value.split(":").map(Number);
    const base = date ? new Date(date) : new Date();
    base.setHours(hours, minutes, 0, 0);
    onChange(format(base, "yyyy-MM-dd'T'HH:mm"));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="h-4 w-4" />
          {date ? format(date, "MMM d, yyyy  HH:mm") : placeholder}
        </button>
      </PopoverTrigger>
      <PopoverContent className="z-50 w-auto p-0" align="start" side="top" avoidCollisions>
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleDateSelect}
          showOutsideDays={false}
          captionLayout="dropdown"
          startMonth={new Date(2024, 0)}
          endMonth={new Date(2030, 11)}
          className="p-2 text-xs [--cell-size:--spacing(6)]"
        />
        <div className="border-t px-2 py-1.5 flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Time:</label>
          <input
            type="time"
            value={timeStr}
            onChange={handleTimeChange}
            className="rounded border bg-background px-2 py-0.5 text-xs outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
