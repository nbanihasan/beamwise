/** Content model. Everything the app shows is described by these types, so contributors add data, not plumbing. */

export type Level = 'foundation' | 'core' | 'advanced' | 'frontier';

export interface TrackDef {
  id: string;
  title: string;
  blurb: string;
  /** Wavelength used to colour-code the track (nm). Purely a visual signature. */
  wavelength: number;
  order: number;
}

export interface LessonMeta {
  /** Unique slug, used in the URL: #/learn/<id> */
  id: string;
  track: string;
  order: number;
  title: string;
  subtitle: string;
  level: Level;
  minutes: number;
  tags: string[];
  /** Lesson ids a learner should read first. */
  prerequisites: string[];
  /** Reference ids from content/references.ts */
  references: string[];
  objectives: string[];
  /** ISO date of the last substantive content update. */
  updated: string;
  contributors?: string[];
  /** Set true while a lesson is being written; it is listed but marked as a draft. */
  draft?: boolean;
}

export type RefKind = 'survey' | 'tutorial' | 'book' | 'paper' | 'standard' | 'magazine';

export interface Reference {
  id: string;
  kind: RefKind;
  authors: string;
  title: string;
  venue: string;
  year: number;
  doi?: string;
  url?: string;
  note?: string;
  topics: string[];
}

export interface GlossaryTerm {
  term: string;
  abbr?: string;
  def: string;
  lessons?: string[];
}
