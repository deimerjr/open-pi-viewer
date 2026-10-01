export type CommandSource = 'pi' | 'gentle-pi' | 'gentle-shell';

export interface CommandDefinition {
  id: string;
  name: string;
  aliases?: string[];
  description: string;
  descriptionEn: string;
  source: CommandSource;
  usage?: string;
  isClientAction?: boolean;
}

export interface MatchedCommand {
  command: CommandDefinition;
  score: number;
}
