import { Button } from "@/components/ui/button.js";
import { MonthCalendar } from "@/components/booking/month-calendar.js";

export function StepDate({ value, onSelect, onBack }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-3xl">Pick a date</h2>
        <Button variant="ghost" className="h-10 min-h-0 px-5 text-sm" onClick={onBack}>
          Back
        </Button>
      </div>
      <div className="mt-6 max-w-md">
        <MonthCalendar value={value} onPick={onSelect} />
      </div>
    </div>
  );
}
