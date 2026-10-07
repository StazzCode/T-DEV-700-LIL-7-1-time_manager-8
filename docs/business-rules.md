# Règles métier

Règles de calcul du temps de travail. Elles sont implémentées dans `backend/src/reports/calc/time-calc.ts` et vérifiées par `time-calc.spec.ts`.

Toute modification d'une règle passe par une PR qui met à jour ce fichier et les tests.

## Conventions

- Les instants sont stockés en UTC (`timestamptz`).
- Les jours et les semaines sont calculés dans le fuseau de l'entreprise : `Europe/Paris`.
- Les semaines suivent la norme ISO 8601 : du lundi au dimanche, et la semaine appartient à l'année de son jeudi. 2026 compte 53 semaines.
- Dans les tests, les dates sont écrites en UTC. Paris est à UTC+2 jusqu'au 25 octobre 2026, puis à UTC+1.

## Pointage

| Réf. | Règle | Garantie par |
| --- | --- | --- |
| R-01 | Un employé a au plus une session ouverte. Pointer une arrivée avec une session ouverte renvoie `409`. | Index unique partiel en base |
| R-02 | Pointer un départ sans session ouverte renvoie `409`. | Service time-entries |
| R-03 | L'heure de pointage est celle du serveur. Le client n'envoie jamais d'heure. | `DEFAULT now()`, DTO sans date |
| R-11 | Un pointage n'est jamais modifié directement. Une correction est demandée par l'employé, validée par son manager et inscrite au journal d'audit. | Tables `correction_requests` et `audit_logs` |

Ces quatre règles se testent en e2e, avec la base.

## Calcul des heures

| Réf. | Règle | Fonction |
| --- | --- | --- |
| R-04 | Une session est rattachée au jour local de Paris, pas au jour UTC. | `localDate` |
| R-05 | Une session qui passe minuit compte pour le jour d'arrivée. | `dailyMinutes` |
| R-06 | Les sessions ouvertes ne comptent pas dans les totaux. L'arrondi à la minute se fait une fois sur le total du jour, pas session par session. | `dailyMinutes`, `weeklyMinutes` |
| R-07 | Une session de plus de 12 h, ouverte ou fermée, est un oubli probable. Elle est signalée et exclue des totaux jusqu'à sa correction. | `isSuspicious` |
| R-08 | Plusieurs sessions par jour sont permises (pause déjeuner = départ puis arrivée). Elles s'additionnent et ne se chevauchent jamais. | `dailyMinutes`, contrainte `EXCLUDE` |
| R-12 | Les durées sont calculées sur des instants UTC : elles restent exactes lors des changements d'heure. | `dailyMinutes` |

## KPI

| KPI | Définition | Fonction |
| --- | --- | --- |
| Ponctualité (R-09) | Jours où la première arrivée est au plus tard à l'heure prévue + 5 min, divisés par les jours travaillés prévus au planning. Sans planning individuel : lundi à vendredi, 09:00. Les jours hors planning (week-end) ne comptent pas. | `punctuality` |
| Écart au contrat (R-10) | Heures travaillées de la semaine − heures contractuelles (35 h par défaut). Positif = heures supplémentaires. | `contractGapMinutes` |
| Conformité | Alertes quand une journée dépasse 10 h, une semaine 48 h, ou quand le repos entre deux journées est inférieur à 11 h (Code du travail, art. L3121-18, L3121-20, L3131-1). | `complianceAlerts` |

## Moyennes d'équipe (R-13)

- Moyenne quotidienne = total des heures de l'équipe ÷ (membres actifs × jours ouvrés de la période).
- Moyenne hebdomadaire = total des heures ÷ (membres actifs × semaines ISO de la période).
- Fonctions : `workingDays`, `teamAverage`.

Limite connue : les jours fériés sont comptés comme jours ouvrés. Ajouter une liste de jours fériés si les RH en ont besoin.

## Paramètres

| Paramètre | Valeur | Règle |
| --- | --- | --- |
| Fuseau de l'entreprise | `Europe/Paris` | R-04 |
| Durée max d'une session | 12 h | R-07 |
| Tolérance de retard | 5 min | R-09 |
| Contrat par défaut | 35 h / semaine | R-10 |
