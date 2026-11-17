import type { CSSProperties } from 'react';

type SchoolColorStyle = CSSProperties & { '--school-symbol-hue': number };

export function getSchoolColorStyle(schoolId: string, schoolIds: readonly string[]): SchoolColorStyle {
  const orderedIds = [...new Set(schoolIds)].sort();
  const index = orderedIds.indexOf(schoolId);
  const hue = (Math.max(index, 0) * 360) / Math.max(orderedIds.length, 1);
  return { '--school-symbol-hue': hue };
}
