// templates.ts — the starting files the New project wizard offers.
//
// Each template is plain Python that runs in the browser today: a list, a loop,
// a function. The strategy shapes (EMA crossover, RSI pullback, SAR) return
// once the engine hooks land in the Lab; until then a project should open on
// code that prints something the first time it is run.
import { Activity, Crosshair, FileCode, TrendingUp, type LucideIcon } from 'lucide-react';

export type LabTemplateId = 'blank' | 'moving-average' | 'loops' | 'functions';

export interface LabTemplate {
  id: LabTemplateId;
  name: string;
  summary: string;
  /** Where the starting code lives, shown under the name. */
  rule: string;
  /** The first lines of the file, shown in the wizard. */
  preview: string[];
  /** What every project starts with: workspace/main.py. */
  code: string;
  icon: LucideIcon;
}

const BLANK = `# A blank file to start from.
# Run it, or edit it into anything you like.

print("Hello from the Lab")
`;

const MOVING_AVERAGE = `# The average of a list of closes, and how far each one sits from it.

prices = [101.5, 99.2, 103.8, 98.4, 105.1]
average = sum(prices) / len(prices)

print(f"{len(prices)} closes, average {average:.2f}")
print()

for price in prices:
    change = (price - average) / average * 100
    print(f"{price:>6.1f}   {change:+5.1f}% from the average")
`;

const LOOPS = `# A loop that builds a list, then reads it back.

trades = [12.4, -3.8, 7.1, -1.2, 9.6]
results = []

for trade in trades:
    results.append(round(trade * 2, 2))

print("doubled:", results)
print("wins:", [value for value in results if value > 0])
print("total:", round(sum(results), 2))
`;

const FUNCTIONS = `# A small function with a docstring, called a few times.


def percent_change(value, base):
    """How far value sits from base, as a percentage."""
    return (value - base) / base * 100


for close in (99.2, 104.8, 97.5):
    print(close, f"{percent_change(close, 100):+.1f}%")
`;

export const LAB_TEMPLATES: LabTemplate[] = [
  {
    id: 'blank',
    name: 'Blank file',
    summary: 'One file with a greeting, and room for whatever comes next.',
    rule: 'Starts in workspace/main.py',
    preview: ['# A blank file to start from.', 'print("Hello from the Lab")'],
    code: BLANK,
    icon: FileCode,
  },
  {
    id: 'moving-average',
    name: 'Moving average',
    summary: 'Average a list of closes and print how far each one sits from it.',
    rule: 'Starts in workspace/main.py',
    preview: ['prices = [101.5, 99.2, 103.8]', 'average = sum(prices) / len(prices)'],
    code: MOVING_AVERAGE,
    icon: TrendingUp,
  },
  {
    id: 'loops',
    name: 'Loops and lists',
    summary: 'Build a list in a loop, then filter and total it.',
    rule: 'Starts in workspace/main.py',
    preview: ['for trade in trades:', '    results.append(trade * 2)'],
    code: LOOPS,
    icon: Activity,
  },
  {
    id: 'functions',
    name: 'Functions',
    summary: 'A function with a docstring, called with a few values.',
    rule: 'Starts in workspace/main.py',
    preview: ['def percent_change(value, base):', '    return (value - base) / base * 100'],
    code: FUNCTIONS,
    icon: Crosshair,
  },
];

export function getTemplate(id: LabTemplateId): LabTemplate {
  return LAB_TEMPLATES.find((template) => template.id === id) ?? LAB_TEMPLATES[0];
}
