export type ItemType = "tool" | "link" | "opportunity";
export type FilterTab = "all" | "tools" | "links" | "opportunities" | "trending";

export interface SignalItem {
  id: string;
  type: ItemType;
  title: string;
  description: string;
  url: string;
  tags: string[];
  votes: number;
  comments: number;
  submittedAt: string; // ISO-8601
  trendingScore: number;
  source?: string;     // display domain for links
  salary?: string;     // opportunities only
  location?: string;   // opportunities only
}
