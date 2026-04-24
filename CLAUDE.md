# Signal Flow - Claude Context

## R\u00e8gles UI Stricte
- **Fallback Structure** : Toute page attendant des donn\u00e9es d'un webhook asynchrone (comme la page Studio) doit poss\u00e9der un \u00e9tat de secours (fallback structure) qui maintient le layout intact sans donn\u00e9es de base de donn\u00e9es.
- **Gestion d'Erreur Asynchrone** : En cas d'absence de donn\u00e9es critiques (ex: ID_post manquant), logger explicitement "SCHtroumf" dans la console et afficher l'interface vide mais structur\u00e9e.
- **D\u00e9fense de l'Interface** : Priorit\u00e9 \u00e0 la stabilit\u00e9 visuelle. Un \u00e9chec de chargement ne doit jamais briser le layout global.

## Architecture
- **Validation** : Toujours valider les payloads externes (Make, Supabase) avant traitement.
- **\u00c9tats de Chargement** : Utiliser des Skeleton Loaders pour les transitions asynchrones.
