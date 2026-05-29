import { stationsMatch } from "@/lib/metroStations";
import {
  parseStationFacilityAreas,
  type StationFacilityArea,
} from "@/lib/stationFacility";
import type { DailyReport } from "@/lib/types";
import { allStationNamesForReport, shortStationLabel } from "@/lib/visitGroup";

/** 【역명】 단위로 수행 내용 분리 */
export function parseDoneSections(done: string): Record<string, string> {
  const text = done.trim();
  if (!text) return {};
  const sections: Record<string, string> = {};
  const re = /【([^】]+)】/g;
  let lastKey: string | null = null;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (lastKey != null) {
      const chunk = text.slice(lastIndex, m.index).trim();
      if (chunk) sections[lastKey] = chunk;
    }
    lastKey = m[1]!.trim();
    lastIndex = m.index + m[0].length;
  }
  if (lastKey != null) {
    const chunk = text.slice(lastIndex).trim();
    if (chunk) sections[lastKey] = chunk;
  }
  if (!Object.keys(sections).length) {
    return { "": text };
  }
  return sections;
}

export function formatDoneSections(sections: Record<string, string>): string {
  const keys = Object.keys(sections).filter((k) => sections[k]?.trim());
  if (!keys.length) return "";
  if (keys.length === 1 && keys[0] === "") {
    return sections[""]!.trim();
  }
  return keys
    .map((k) => `【${k}】\n${sections[k]!.trim()}`)
    .join("\n\n");
}

function sectionKeyForStation(station: string): string {
  return shortStationLabel(station) || station.trim();
}

export function pickDoneForStation(done: string, station: string): string {
  const sections = parseDoneSections(done);
  const keys = Object.keys(sections);
  if (!keys.length) return "";
  if (keys.length === 1 && keys[0] === "") {
    return sections[""] ?? "";
  }
  for (const k of keys) {
    if (stationsMatch(k, station)) return sections[k] ?? "";
  }
  const label = sectionKeyForStation(station);
  for (const k of keys) {
    if (k === label || stationsMatch(k, label)) return sections[k] ?? "";
  }
  return "";
}

/** 구분 없이 저장된 본문을 첫 역사 키로 옮김 */
export function migrateLegacyDoneToPrimary(
  done: string,
  primaryStation: string
): string {
  const sections = parseDoneSections(done);
  if (!sections[""]?.trim() || !primaryStation.trim()) {
    return done;
  }
  const key = sectionKeyForStation(primaryStation);
  if (!sections[key]) {
    sections[key] = sections[""]!;
  }
  delete sections[""];
  return formatDoneSections(sections);
}

export function mergeDoneForStation(
  existingDone: string,
  station: string,
  newDone: string
): string {
  const sections = parseDoneSections(existingDone);
  const key = sectionKeyForStation(station);
  if (newDone.trim()) {
    sections[key] = newDone.trim();
  } else {
    delete sections[key];
  }
  if (Object.keys(sections).length === 1 && sections[""]) {
    return sections[""]!.trim();
  }
  return formatDoneSections(sections);
}

export interface FieldVisitSaveInput {
  stationName: string;
  facilityArea: StationFacilityArea | string;
  processingRole: string;
  done: string;
  plan?: string;
  issues?: string;
  deficiencies?: string;
  beforePhotoAt?: string;
  afterPhotoAt?: string;
  visitGroupId?: string;
}

/** 같은 날 다른 역사 일일기록을 덮어쓰지 않고 병합 */
export function mergeFieldVisitSave(
  existing: DailyReport,
  visit: FieldVisitSaveInput
): FieldVisitSaveInput & {
  stationName: string;
  additionalStationNames?: string[];
  facilityArea: string;
  additionalFacilityAreas?: string[];
} {
  const focus = visit.stationName.trim();
  const allNames = allStationNamesForReport(existing);
  const existingFacilities = parseStationFacilityAreas(
    existing.facilityArea,
    existing.additionalFacilityAreas
  );
  const normalizedDone = migrateLegacyDoneToPrimary(
    existing.done ?? "",
    existing.stationName ?? ""
  );
  const mergedDone = mergeDoneForStation(normalizedDone, focus, visit.done);

  const base = {
    ...visit,
    done: mergedDone,
    plan: visit.plan?.trim() ? visit.plan : existing.plan,
    issues: visit.issues?.trim() ? visit.issues : existing.issues,
    deficiencies: visit.deficiencies?.trim()
      ? visit.deficiencies
      : existing.deficiencies,
    visitGroupId: visit.visitGroupId?.trim() || existing.visitGroupId,
  };

  const updatingPrimary =
    allNames.length > 0 && stationsMatch(allNames[0]!, focus);

  if (updatingPrimary || allNames.length === 0) {
    const additional = existing.additionalStationNames ?? [];
    return {
      ...base,
      stationName: existing.stationName?.trim() || focus,
      additionalStationNames: additional.length ? additional : undefined,
      facilityArea: visit.facilityArea,
      additionalFacilityAreas:
        existing.additionalFacilityAreas?.length
          ? existing.additionalFacilityAreas
          : undefined,
      beforePhotoAt: visit.beforePhotoAt ?? existing.beforePhotoAt,
      afterPhotoAt: visit.afterPhotoAt ?? existing.afterPhotoAt,
    };
  }

  const addIdx = allNames.findIndex((n, i) => i > 0 && stationsMatch(n, focus));
  if (addIdx > 0) {
    const additional = [...(existing.additionalStationNames ?? [])];
    const facilities = [...existingFacilities];
    if (facilities[addIdx]) {
      facilities[addIdx] = visit.facilityArea as StationFacilityArea;
    }
    return {
      ...base,
      stationName: existing.stationName!,
      additionalStationNames: additional,
      facilityArea: facilities[0] ?? visit.facilityArea,
      additionalFacilityAreas: facilities.slice(1).filter(Boolean),
      beforePhotoAt: existing.beforePhotoAt,
      afterPhotoAt: existing.afterPhotoAt,
    };
  }

  return {
    ...base,
    stationName: existing.stationName!,
    additionalStationNames: [
      ...(existing.additionalStationNames ?? []),
      focus,
    ],
    facilityArea: existing.facilityArea ?? visit.facilityArea,
    additionalFacilityAreas: [
      ...(existing.additionalFacilityAreas ?? []),
      visit.facilityArea,
    ],
    beforePhotoAt: existing.beforePhotoAt,
    afterPhotoAt: existing.afterPhotoAt,
  };
}
