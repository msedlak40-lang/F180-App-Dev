import React from "react";

/** Dark theme for native selects/date/time pickers inside .f180 shells. */
export default function F180NativeControlTheme() {
  return (
    <style>{`
      .f180 select,
      .f180 input[type="time"],
      .f180 input[type="date"],
      .f180 input[type="datetime-local"] {
        background-color: hsl(var(--popover));
        color: hsl(var(--popover-foreground));
        border: 1px solid hsl(var(--input));
        color-scheme: dark;
      }
      .f180 input[type="time"]::-webkit-calendar-picker-indicator,
      .f180 input[type="date"]::-webkit-calendar-picker-indicator,
      .f180 input[type="datetime-local"]::-webkit-calendar-picker-indicator {
        filter: invert(1) opacity(0.9);
      }
      .f180 select:focus,
      .f180 input[type="time"]:focus,
      .f180 input[type="date"]:focus,
      .f180 input[type="datetime-local"]:focus {
        outline: none;
        box-shadow: 0 0 0 2px hsl(var(--ring));
      }
    `}</style>
  );
}
