// Certificate ranks for "Hau den Legacy!" (90 s round). Everyone gets a certificate.
export const RANKS = [
  { id: 'gold', min: 6000, name: 'Gold', title: 'CRM-Großmeister:in', line: 'Legacy-Systeme fürchten deinen Namen.' },
  { id: 'silber', min: 3500, name: 'Silber', title: 'CRM-Profi', line: 'Solide Abrissarbeit. Excel zittert schon.' },
  { id: 'bronze', min: 1500, name: 'Bronze', title: 'CRM-Talent', line: 'Da geht noch was, aber der Anfang ist gemacht.' },
  { id: 'teilnahme', min: 0, name: 'Teilnahme', title: 'CRM-Azubi', line: 'Nachsitzen empfohlen. Aber hey: dabei sein ist alles.' }
];
export const rankFor = (score) => RANKS.find((r) => score >= r.min) || RANKS[RANKS.length - 1];
