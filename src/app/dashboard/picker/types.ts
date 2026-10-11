export interface Elective {
  id: string;
  groupId: string;
  courseCode: string | null;
  name: string;
  credits?: number;
  description?: string | null;
  maxSeats: number;
  availableSeats: number;
  isActive: boolean;
  isFull: boolean;
  sectionAvailableSeats?: number;
  sectionMaxSeats?: number;
}

export interface Group {
  id: string;
  name: string;
  minChoices: number;
  maxChoices: number;
}

export type Selections = Record<string, string[]>;

export function ruleText(g: Group) {
  if (g.minChoices === g.maxChoices) return `Pick ${g.minChoices}`;
  return `Pick ${g.minChoices} to ${g.maxChoices}`;
}

export function groupComplete(g: Group, picked: number) {
  return picked >= g.minChoices && picked <= g.maxChoices;
}

export function displayName(e: Pick<Elective, "courseCode" | "name">) {
  return e.courseCode ? `${e.courseCode} ${e.name}` : e.name;
}
