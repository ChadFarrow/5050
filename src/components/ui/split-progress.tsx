import * as React from "react"
import { cn } from "@/lib/utils"

interface SplitProgressProps {
  className?: string;
  ticketValue: number; // 0-100
  donationValue: number; // 0-100
  totalValue: number; // 0-100 (combined progress toward goal)
}

const SplitProgress = React.forwardRef<
  HTMLDivElement,
  SplitProgressProps
>(({ className, ticketValue, donationValue, totalValue }, ref) => {
  // Calculate proportions within the filled area
  const filledWidth = Math.min(totalValue, 100);
  const totalFilled = ticketValue + donationValue;
  
  let ticketProportion = 0;
  let donationProportion = 0;
  
  if (totalFilled > 0) {
    ticketProportion = (ticketValue / totalFilled) * filledWidth;
    donationProportion = (donationValue / totalFilled) * filledWidth;
  }

  return (
    <div
      ref={ref}
      className={cn(
        "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
        className
      )}
    >
      {/* Ticket portion (purple) */}
      {ticketProportion > 0 && (
        <div
          className="absolute top-0 left-0 h-full bg-purple-500 transition-all"
          style={{ width: `${ticketProportion}%` }}
        />
      )}
      
      {/* Donation portion (blue) */}
      {donationProportion > 0 && (
        <div
          className="absolute top-0 h-full bg-blue-500 transition-all"
          style={{ 
            left: `${ticketProportion}%`,
            width: `${donationProportion}%` 
          }}
        />
      )}
    </div>
  )
})
SplitProgress.displayName = "SplitProgress"

export { SplitProgress }