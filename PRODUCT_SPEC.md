# PAYSAN — PRODUCT_SPEC.md

*Cahier des charges produit, technique et MVP — source de vérité pour Claude Code*

Version 1.2 — 3 novembre 2026
Nom de travail : **PAYSAN** (provisoire, ni domaine ni identité visuelle arrêtés)

> **Changements depuis la v1.1**
> - Lot 0 (Setup) terminé et vérifié : statut ajouté au §12, détail dans le journal d'avancement (§18).
> - Choix techniques de socle actés au §15.1 (versions Next.js / Node, outils de test et de qualité).
>
> **Changements v1.0 → v1.1**
> - Nom de travail du projet fixé à « PAYSAN » (provisoire).
> - Ajout de la règle « aucun classement ni visibilité payants » aux principes non négociables (§2) et aux tests d'acceptation (§13).
> - Géocodage acté : API de géocodage de la Géoplateforme IGN (données BAN) (§7, §7.1, §15).

---

## 0. Comment utiliser ce document avec Claude Code

Ce document est la source de vérité du MVP. Il est placé à la racine du dépôt sous le nom `PRODUCT_SPEC.md`. Claude Code doit le lire avant toute modification importante. Le projet doit être construit par petites étapes vérifiables : ne pas générer toute l'application en une seule fois.

Règle de travail : Claude Code doit d'abord inspecter le dépôt, résumer l'existant et proposer un plan. Il ne doit pas inventer de choix métier non définis, ni ajouter des fonctionnalités hors MVP sans validation.

Règle de suivi : à la fin de chaque lot (et à chaque modification de périmètre), mettre à jour le statut du §12, le journal du §18, le fichier `TODO.md` du dépôt, et la version de ce document.

### Prompt initial à copier dans Claude Code

```
Tu es un ingénieur logiciel senior, architecte full-stack et product engineer.
Tu travailles sur PAYSAN (nom provisoire), une application web responsive qui aide les consommateurs à trouver les producteurs locaux et leurs points de vente.

Commence par lire intégralement PRODUCT_SPEC.md et respecter ses décisions.
Étape 1 : inspecte le dépôt et les outils déjà configurés. Ne modifie aucun fichier.
Étape 2 : résume l'architecture proposée, les risques et les décisions qui restent à prendre.
Étape 3 : propose un plan d'implémentation découpé en tickets de petite taille, avec critères d'acceptation.
Attends ma validation avant de coder.

Contraintes :
- priorité à un MVP robuste, simple et maintenable ;
- pas de paiement, commande, livraison, stock, avis ou messagerie dans le MVP ;
- aucun mécanisme de classement, de mise en avant ou de visibilité payante : l'ordre des résultats dépend uniquement de critères objectifs (distance, filtres, pertinence de la recherche) ;
- ne pas surconcevoir l'UI : interface sobre, fonctionnelle, mobile-first ; le design sera amélioré après validation ;
- sécurité dès le départ : contrôle d'accès côté serveur et politiques RLS Supabase ;
- aucune clé secrète dans le frontend ou dans le dépôt ;
- pas de données fictives présentées comme réelles ;
- utiliser TypeScript strict, composants réutilisables et migrations SQL versionnées ;
- le nom « PAYSAN » est provisoire : le centraliser dans une configuration unique (pas en dur dans les composants) ;
- à chaque étape, expliquer les fichiers créés/modifiés, les commandes exécutées, les tests et les limites connues.
Ne passe pas à l'étape suivante sans validation explicite.
```

## 1. Vision et périmètre

Créer une plateforme nationale de découverte des producteurs et points de vente en circuit court. La carte couvre toute la France dès le départ, mais le lancement commercial et la densité initiale de données se concentrent sur un territoire pilote autour de Sées et dans l'Orne. Les producteurs doivent pouvoir créer et maintenir eux-mêmes leur fiche.

**Promesse consommateur** : trouver rapidement où acheter localement, près de soi ou dans une zone choisie, avec des informations pratiques et suffisamment fiables.

**Promesse producteur** : être visible gratuitement sur une carte nationale, présenter son activité et indiquer simplement tous ses lieux et horaires de vente.

## 2. Principes produit non négociables

- La plateforme est un annuaire géolocalisé, pas une marketplace : aucune transaction ni commande en ligne dans le MVP.
- **Aucun producteur ne peut payer pour être mis en avant.** Pas de classement achetable, pas de position sponsorisée, pas de marqueur ou badge mis en valeur contre paiement, ni dans le MVP ni dans les versions ultérieures. L'ordre des résultats et la visibilité sur la carte reposent exclusivement sur des critères objectifs : distance, filtres choisis par l'utilisateur, pertinence textuelle de la recherche. Toute future offre payante (ex. statistiques, outils de communication) ne doit jamais influencer l'affichage ou l'ordre des résultats.
- La France entière est consultable, même si certaines zones sont encore peu couvertes.
- Un producteur peut gérer plusieurs points de vente ; chaque point de vente a sa propre adresse, position et ses propres horaires.
- La fiche producteur et chaque point de vente ont une URL publique stable et partageable.
- Un producteur peut être référencé par l'équipe puis revendiquer sa fiche via un parcours sécurisé.
- Les consommateurs peuvent parcourir la carte sans créer de compte ; un compte est requis pour synchroniser les favoris.
- Les informations doivent afficher leur date de dernière mise à jour ou de confirmation.
- L'interface doit être mobile-first, légère et compréhensible par des utilisateurs peu à l'aise avec le numérique.

**Conséquence technique de la règle anti-classement payant** : la logique de tri des résultats (requêtes SQL, fonctions RPC, composants de liste) ne doit contenir aucun champ ni paramètre lié à un statut commercial, un abonnement ou une priorité attribuée manuellement. Aucune colonne de type `boost`, `priority`, `sponsored`, `featured` ou équivalent ne doit être ajoutée aux tables `producers` ou `sales_points`.

## 3. Utilisateurs et rôles

| Rôle | Droits principaux |
| --- | --- |
| Visiteur | Consulter la carte, rechercher, filtrer, ouvrir les fiches et partager les URL. |
| Utilisateur connecté | Tous les droits visiteur + ajouter/retirer des producteurs en favoris. |
| Producteur / gestionnaire | Créer et modifier sa fiche, gérer ses produits, ses points de vente et leurs horaires. |
| Administrateur | Créer/préremplir des fiches, valider/masquer, gérer les signalements et aider à revendiquer une fiche. |

## 4. Fonctionnalités MVP

### 4.1 Interface consommateur

- Page d'accueil avec carte, champ de recherche et accès aux filtres.
- Géolocalisation demandée uniquement après action explicite de l'utilisateur ; si refusée, proposer une recherche par ville ou code postal.
- Carte et liste synchronisées : marqueurs pour les points de vente, résultats triés par distance lorsque la position est connue.
- Recherche par ville, code postal, nom de producteur et catégorie de produits.
- Filtres MVP : catégories (fruits/légumes, viande, volailles, produits laitiers, fromage, lait, œufs, miel, pain/céréales, boissons, autres), vente à la ferme, marché, magasin/dépôt, distributeur automatique.
- Fiche producteur : nom, description, photos, catégories, coordonnées publiques choisies, liens externes éventuels, liste de ses points de vente.
- Fiche point de vente : nom/type, adresse, carte, horaires hebdomadaires, périodes ou fermetures exceptionnelles si prévues, date de dernière mise à jour.
- Favoris : ajouter/retirer un producteur ; page dédiée aux favoris pour les utilisateurs connectés.
- Boutons d'action : itinéraire via application de cartographie externe, appeler, visiter le site ou réseau social si renseignés.
- Signalement d'une information incorrecte, sans publier de commentaire public.

### 4.2 Espace producteur

- Inscription et connexion par email (mot de passe ou lien magique, choix à confirmer à l'implémentation).
- Création de fiche avec nom commercial, description courte, photos, catégories de produits, téléphone/site/réseaux sociaux facultatifs.
- Ajout, modification, désactivation et suppression logique de plusieurs points de vente.
- Pour chaque point : nom affiché, type, adresse, géocodage, latitude/longitude, précision/état de validation, horaires par jour, notes pratiques.
- Saisie d'adresse avec suggestions (autocomplétion) puis placement du marqueur ; le producteur peut déplacer le marqueur pour corriger la position (voir §7.1).
- Gestion simple des horaires : fermé, créneau(x), horaires variables ; ne pas supposer qu'un horaire est identique pour tous les lieux.
- Aperçu public de la fiche et liens uniques à copier/partager.
- Date de dernière modification et action « confirmer mes informations à jour ».
- Statut de fiche : brouillon, en attente de validation, publiée, suspendue.

### 4.3 Administration

- Liste et recherche des producteurs et points de vente.
- Créer une fiche préremplie et envoyer une invitation sécurisée au producteur pour la revendiquer.
- Valider, publier, suspendre ou archiver une fiche.
- Consulter les signalements et marquer leur traitement.
- Voir les fiches non confirmées depuis un délai configurable.
- Ne pas construire un CMS complexe : un back-office simple suffit.
- L'administrateur ne dispose d'aucun outil pour modifier l'ordre d'affichage ou mettre en avant une fiche (cf. §2).

## 5. Parcours prioritaires

| Parcours | Étapes attendues |
| --- | --- |
| Trouver un producteur proche | Accueil → autoriser localisation ou saisir ville → carte/liste → filtre → fiche point de vente → itinéraire. |
| Trouver un produit | Accueil → choisir fromage/viande/miel… → résultats proches → fiche producteur → point de vente. |
| Producteur autonome | Créer compte → compléter fiche → ajouter point(s) de vente → renseigner horaires → soumettre → validation → partager URL. |
| Revendiquer une fiche | Recevoir invitation → vérifier email → associer compte à la fiche existante → vérifier/compléter les données → publier. |
| Signaler une erreur | Fiche point de vente → signaler → choisir type d'erreur + détail facultatif → accusé de réception. |

## 6. URLs publiques et partage

Prévoir des slugs lisibles, uniques et stables. Exemples indicatifs : `/producteurs/ferme-des-pres` et `/points-de-vente/marche-de-sees`. Le slug ne doit pas être l'identifiant de base de données. Conserver un UUID interne et gérer les collisions de slugs.

- URL producteur : page publique avec présentation, catégories et tous les lieux de vente.
- URL point de vente : page publique centrée sur l'adresse, les horaires et les informations pratiques.
- Bouton « Copier le lien » et partage natif mobile si disponible.
- QR code généré à partir de l'URL publique ; prévoir une version imprimable.
- Les URLs doivent rester valides si le nom commercial change ; mettre en place une redirection ou conserver un alias.
- Le nom de domaine n'étant pas arrêté, l'URL de base doit provenir d'une variable d'environnement (`NEXT_PUBLIC_SITE_URL`), jamais être codée en dur. Ne pas imprimer de QR codes définitifs avant le choix du domaine. *(Mis en place au Lot 0 : `src/config/site.ts` → `absoluteUrl()`.)*

## 7. Architecture technique recommandée

| Couche | Choix de départ | Rôle |
| --- | --- | --- |
| Application | Next.js + TypeScript | Application web responsive et routes publiques/privées. |
| UI | Tailwind CSS + composants simples (shadcn/ui possible) | Construire vite sans chercher un design final. |
| Backend / DB | Supabase (PostgreSQL) | Données, authentification, stockage photo et API. |
| Géospatial | PostGIS dans Supabase | Recherche par rayon, distance et index géographiques. |
| Carte | MapLibre GL JS + fond OpenStreetMap ou fournisseur compatible | Carte et marqueurs ; éviter de dépendre trop tôt d'un fournisseur unique. |
| **Géocodage** | **API de géocodage de la Géoplateforme IGN (données BAN) — DÉCIDÉ** | Convertir adresse ↔ coordonnées et rechercher une ville / un code postal. Voir §7.1. |
| Hébergement | Vercel ou équivalent | Déploiement web et environnements preview/production. |
| Analytics | PostHog ou alternative respectueuse de la vie privée | Mesurer les usages essentiels après information/consentement si requis. |

Note cartographique : ne pas utiliser les serveurs publics de tuiles OpenStreetMap comme infrastructure de production sans vérifier leur politique d'utilisation. Choisir un fournisseur de tuiles adapté, ou héberger/contractualiser le service si le trafic augmente. Le choix final des **tuiles** reste à documenter avant mise en production (le géocodage, lui, est décidé).

### 7.1 Géocodage — décision et règles d'implémentation

**Décision** : le géocodage utilise l'API publique de géocodage de la Géoplateforme (IGN), qui s'appuie sur la Base Adresse Nationale (BAN). Elle est gratuite, sans clé d'API et adaptée aux adresses françaises.

Points d'entrée :
- Géocodage direct : `https://data.geopf.fr/geocodage/search`
- Géocodage inverse : `https://data.geopf.fr/geocodage/reverse`
- Capacités : `https://data.geopf.fr/geocodage/getCapabilities`
- L'ancien domaine `api-adresse.data.gouv.fr` ne doit pas être utilisé pour du nouveau code.

Contraintes connues :
- Limite d'usage : 50 requêtes par seconde et par IP pour le géocodage ; au-delà, réponse HTTP 429 et blocage temporaire. L'API d'autocomplétion de la Géoplateforme a une limite plus basse (10 requêtes/seconde/IP).
- Couverture : France uniquement. Cohérent avec le périmètre ; la question DROM-COM reste ouverte (§15).

Règles d'implémentation :
1. **Encapsulation** : tous les appels passent par un module unique côté serveur (ex. `lib/geocoding/`) exposant une interface interne (`geocodeAddress`, `reverseGeocode`, `searchPlace`). Aucun composant n'appelle l'API directement. Changer de fournisseur ne doit modifier que ce module.
2. **Quand géocoder** : à l'enregistrement ou à la modification d'une adresse de point de vente, et pour la recherche consommateur par ville/code postal. Ne jamais géocoder à l'affichage : les coordonnées sont stockées dans `sales_points.location`.
3. **Cache** : mettre en cache les recherches ville/code postal (table ou cache applicatif avec durée de vie) pour limiter les appels répétés.
4. **Autocomplétion** : debounce côté client (≥ 300 ms), minimum 3 caractères, et appel via une route serveur avec limitation de débit. Gérer proprement les réponses 429 (message clair, nouvelle tentative différée).
5. **Précision** : stocker le score et le type de résultat renvoyés par l'API (numéro, rue, commune…) dans un champ de précision ; un résultat de faible précision ou de niveau commune doit être signalé au producteur pour confirmation.
6. **Correction manuelle** : le producteur peut déplacer le marqueur ; la position corrigée prime sur le géocodage et est marquée comme confirmée manuellement.
7. **Lieux sans adresse précise** (marchés de place, distributeurs en bord de route) : le placement manuel du marqueur doit être possible même si le géocodage ne renvoie qu'une commune.
8. **Import admin en lot** : utiliser le géocodage par lot de l'API plutôt que des appels unitaires en boucle, et plafonner le débit sous la limite (ex. 40 requêtes/seconde).
9. **Mentions** : vérifier et afficher les mentions de source requises par la licence des données (BAN / IGN) dans les mentions légales ou crédits de la carte.

## 8. Modèle de données initial

| Table | Champs clés (indicatifs) | Relations / règles |
| --- | --- | --- |
| profiles | id (auth user), role, display_name, created_at | Un profil par compte ; rôles contrôlés côté serveur. |
| producers | id UUID, owner_user_id nullable, name, slug, description, photos, phone, website, social_links, status, verified_at, last_confirmed_at, created_at, updated_at | Un producteur peut être créé par admin avant revendication. Aucun champ de mise en avant (cf. §2). |
| categories | id, name, slug, sort_order, active | Référentiel administré. `sort_order` sert uniquement à l'ordre d'affichage des filtres, jamais au tri des producteurs. |
| producer_categories | producer_id, category_id | Relation N-N. |
| sales_points | id UUID, producer_id, name, type, address fields, location geography(Point), geocode_score, geocode_type, location_source (geocoded / manual), slug, status, notes, last_confirmed_at | Plusieurs lieux par producteur ; index spatial GiST. Aucun champ de mise en avant (cf. §2). |
| opening_hours | id, sales_point_id, day_of_week, opens_at, closes_at, slot_order, valid_from, valid_until | Plusieurs créneaux par jour ; permettre fermeture ; gérer les cas saisonniers ultérieurement. |
| favorites | user_id, producer_id, created_at | Clé unique (user_id, producer_id). |
| reports | id, sales_point_id nullable, producer_id nullable, reporter_email nullable, reason, details, status, created_at | Signalement privé, modération admin. |
| producer_invites | id, producer_id, email, token_hash, expires_at, claimed_at | Token sécurisé, stocker le hash, expiration et usage unique. |
| slug_aliases | id, entity_type, entity_id, old_slug, created_at | Anciens slugs redirigés vers l'URL courante (cf. §6). |

Les champs exacts et les types doivent être finalisés dans les migrations SQL. Pour la recherche géographique, stocker un point PostGIS (SRID 4326) et créer un index spatial. Ne pas calculer les distances en filtrant des milliers de lignes côté navigateur.

## 9. Sécurité, confidentialité et fiabilité

- Activer RLS sur toutes les tables exposées. Un producteur ne peut modifier que sa fiche et les lieux qui lui appartiennent.
- Les visiteurs ne peuvent lire que les fiches et points de vente publiés.
- Les favoris sont privés et accessibles uniquement à leur propriétaire.
- Les actions administrateur doivent être protégées par un rôle vérifié côté serveur, jamais par un simple booléen client.
- Ne jamais exposer la service_role key dans le navigateur. Utiliser des variables d'environnement et séparer dev/staging/production. *(Garde-fou `npm run check:secrets` exécuté en CI depuis le Lot 0.)*
- Valider et nettoyer les entrées ; limiter taille/type des images ; éviter l'upload de fichiers exécutables.
- Limiter les tentatives d'authentification, les soumissions de signalements et les appels de géocodage/autocomplétion ; prévoir anti-spam raisonnable.
- Ne pas afficher l'adresse personnelle d'un producteur si elle n'est pas un lieu de vente public.
- Respecter RGPD : minimisation, politique de confidentialité, durée de conservation, suppression/export des données personnelles, consentement cookies/analytics selon les outils retenus.
- Géolocalisation : demander l'autorisation au bon moment, expliquer son usage et permettre une recherche manuelle sans géolocalisation. La position GPS de l'utilisateur n'est ni stockée ni envoyée au service de géocodage.

## 10. Recherche et carte : comportement attendu

- La carte affiche les points de vente, pas uniquement les sièges d'exploitation.
- Au chargement, ne pas demander la géolocalisation avant que l'utilisateur comprenne l'intérêt ; proposer « Autour de moi ».
- Si une position est disponible, requête serveur par rayon et tri par distance.
- Prévoir un rayon par défaut raisonnable (ex. 25 km) modifiable par l'utilisateur ; le rayon doit être un paramètre, pas une constante métier.
- Pour les grandes densités, charger les résultats selon la zone visible de la carte ou via pagination/limite.
- Synchroniser liste et carte ; sélectionner un marqueur met en évidence la carte résultat correspondante.
- Les filtres doivent être combinables : catégorie + type de vente + distance.
- **Ordre des résultats** : distance (si position connue), sinon pertinence textuelle, puis critère neutre et stable (ex. nom alphabétique). Aucun autre critère.
- Si aucun résultat : expliquer qu'il n'y a pas encore de producteurs référencés et proposer d'élargir le rayon ou de suggérer un producteur.

## 11. Hors périmètre MVP

- Paiement, panier, commandes, livraison et réservation.
- Gestion des stocks, catalogue avec prix détaillés et disponibilité en temps réel.
- Avis, notes publiques, commentaires et messagerie.
- Application native iOS/Android (la PWA suffit au départ).
- Abonnements payants et publicité.
- Classement payant, mise en avant ou visibilité sponsorisée : **exclus définitivement**, pas seulement du MVP (cf. §2).
- Réseau social, fil d'actualité et programme de fidélité complexe.
- Intégrations automatiques avec les caisses ou logiciels agricoles.

## 12. Découpage de développement et critères de sortie

| Lot | Contenu | Critères de sortie | Statut |
| --- | --- | --- | --- |
| 0 — Setup | Repo, Next.js, TypeScript, lint, env, CI basique, configuration centralisée du nom et de l'URL de base | App démarre localement ; README ; secrets absents du repo. | ✅ Terminé et vérifié — 03/11/2026 |
| 1 — DB & auth | Migrations, Supabase, profils, rôles, RLS | Tests d'accès : visiteur/producteur/admin ; aucune fuite de données. | ⏳ Prochain lot |
| 2 — Producteur | CRUD fiche, photos, catégories, points de vente, horaires, module de géocodage Géoplateforme + correction manuelle du marqueur | Producteur peut gérer plusieurs lieux, corriger leur position et prévisualiser ses pages. | À faire |
| 3 — Pages publiques | URLs stables, fiches producteur et point de vente | Pages accessibles sans compte, métadonnées partageables. | À faire |
| 4 — Carte & recherche | Carte, géoloc, recherche ville via géocodage, filtres, PostGIS | Résultats proches et filtres corrects ; fallback sans GPS ; ordre conforme au §10. | À faire |
| 5 — Favoris & signalements | Connexion consommateur, favoris, signalement | Favoris privés ; signalements visibles seulement par admin. | À faire |
| 6 — Admin & invitations | Validation, préremplissage, revendication, géocodage par lot | Admin invite un producteur à reprendre sa fiche. | À faire |
| 7 — Durcissement | Tests, accessibilité de base, SEO, sauvegardes, monitoring | Checklist pré-lancement validée. | À faire |

## 13. Tests d'acceptation indispensables

- Un producteur A ne peut pas modifier la fiche du producteur B, même en appelant directement l'API.
- Un visiteur non connecté ne voit aucune fiche en brouillon ou suspendue.
- Un producteur peut créer au moins trois points de vente avec des horaires différents.
- La carte montre chaque point de vente à sa position réelle et non l'adresse du siège par défaut.
- Une recherche autour d'une position renvoie les lieux dans le rayon et les trie par distance.
- La recherche manuelle par ville fonctionne si la géolocalisation est refusée.
- Une adresse saisie dans l'Orne (ex. une adresse de Sées) est géocodée correctement ; une position déplacée manuellement par le producteur n'est pas écrasée par un nouveau géocodage.
- Une réponse 429 du service de géocodage affiche un message clair et ne casse pas le formulaire.
- Un utilisateur peut ajouter un producteur en favori, actualiser la page et retrouver son favori.
- Une URL producteur et une URL point de vente peuvent être ouvertes et partagées sans connexion.
- Une fiche préremplie peut être revendiquée uniquement par le destinataire autorisé.
- Un changement de nom ne casse pas les liens déjà distribués.
- **Neutralité du classement** : pour une même requête (position, rayon, filtres), l'ordre des résultats est déterminé uniquement par la distance, la pertinence textuelle et le critère de départage neutre ; aucune donnée commerciale ni action admin ne peut le modifier. Un test automatisé vérifie l'ordre sur un jeu de données de test.

## 14. SEO et visibilité des fiches

- Chaque producteur et point de vente publié doit avoir une page HTML indexable, titre et description uniques.
- Générer sitemap.xml et canonical URLs ; ne pas indexer les pages privées, brouillons ou résultats de recherche paramétrés sans stratégie dédiée.
- Ajouter des données structurées pertinentes (LocalBusiness / types adaptés) uniquement si les informations sont exactes et conformes aux règles de Google.
- Les pages doivent être rapides sur mobile et partager une image/description propres (Open Graph).

## 15. Décisions

### 15.1 Décisions actées

| Sujet | Décision | Date |
| --- | --- | --- |
| Nom de travail | PAYSAN (provisoire) | 03/11/2026 |
| Classement / visibilité payants | Interdits définitivement (§2) | 03/11/2026 |
| Géocodage | API de géocodage Géoplateforme IGN / BAN (§7.1) | 03/11/2026 |
| Socle applicatif | Next.js 16 (App Router, dossier `src/`), React 19, TypeScript strict (+ `noUncheckedIndexedAccess`), Tailwind CSS 4 | 03/11/2026 |
| Environnement d'exécution | Node.js ≥ 22 (`.nvmrc`), npm | 03/11/2026 |
| Qualité & tests | ESLint (config Next), Prettier, Vitest ; validation des variables d'environnement par zod ; CI GitHub Actions | 03/11/2026 |

### 15.2 Décisions à ne pas inventer — à confirmer avant production

- Nom de marque définitif, nom de domaine et identité visuelle.
- Pays couverts au lancement : France métropolitaine uniquement ou aussi DROM-COM.
- Quelles catégories exactes et quels types de points de vente sont proposés.
- Quel fournisseur de tuiles cartographiques, après vérification des licences, quotas et coûts.
- La validation admin est-elle obligatoire avant publication ? Recommandation : oui au lancement.
- Les producteurs peuvent-ils afficher un numéro de téléphone public ? Champ facultatif, choix explicite.
- Les horaires exceptionnels sont-ils inclus dès MVP ou seulement horaires hebdomadaires + fermeture temporaire ? Recommandation : prévoir le modèle mais livrer le minimum.
- Mode de connexion : mot de passe ou lien magique (à trancher au Lot 1).
- Hébergement du dépôt (compte/organisation GitHub) et région du projet Supabase (recommandation : UE, pour le RGPD).

## 16. Prompt de reprise pour chaque session Claude Code

```
Relis PRODUCT_SPEC.md et inspecte l'état réel du dépôt.
Indique :
1) ce qui est déjà terminé et vérifié ;
2) ce qui est commencé mais incomplet ;
3) le prochain plus petit ticket utile ;
4) les risques ou écarts par rapport à la spécification.
Propose le plan du ticket et ses critères d'acceptation. Attends ma validation avant de modifier les fichiers.
Après implémentation, exécute les tests pertinents et mets à jour README / TODO si nécessaire.
Ne déclare jamais une tâche terminée si elle n'a pas été testée.
```

## 17. Définition du MVP réussi

Le MVP est réussi lorsque 10 à 20 producteurs pilotes peuvent gérer leurs fiches et plusieurs lieux de vente sans aide technique, que les consommateurs trouvent un point de vente par carte ou recherche, que les URLs sont partageables, et que les données publiées sont suffisamment fiables. Le nombre de fonctionnalités n'est pas le critère : l'autonomie des producteurs et l'utilité réelle de la carte le sont.

## 18. Journal d'avancement

### Lot 0 — Setup — ✅ terminé le 03/11/2026

**Livré**
- Application Next.js 16 (App Router, `src/`) + TypeScript strict + Tailwind CSS 4.
- Configuration centralisée : `src/config/site.ts` (`siteConfig`, `absoluteUrl()`) ; le nom « PAYSAN » et l'URL de base ne sont écrits nulle part en dur dans les composants.
- Variables publiques validées par zod (`src/lib/env.ts`) : `NEXT_PUBLIC_SITE_NAME`, `NEXT_PUBLIC_SITE_URL` ; une URL invalide fait échouer le démarrage.
- `.env.example` documenté ; tous les `.env*` réels ignorés par git.
- Script `npm run check:secrets` : bloque les fichiers `.env` commités, les JWT / clés Supabase en clair et toute référence à la service_role dans un composant client.
- Scripts `lint`, `typecheck`, `test`, `format`, `check` ; CI GitHub Actions (lint, typecheck, format, tests, secrets, build).
- Page d'accueil minimale en français (`lang="fr"`), sans aucune donnée fictive ; métadonnées (titre, description, Open Graph) issues de la config.
- `README.md`, `TODO.md`, `AGENTS.md` / `CLAUDE.md` (règles du projet pour Claude Code), cette spec à la racine.

**Vérifications effectuées**
- `npm run lint` ✔ · `npm run typecheck` ✔ · `npm run format:check` ✔
- `npm run test` ✔ — 7 tests (validation env, construction d'URL absolues)
- `npm run check:secrets` ✔
- `npm run build` ✔ puis `next start` : la page répond avec `lang="fr"`, titre et nom issus de la configuration.

**Limites connues**
- Dépôt git local, pas encore poussé sur GitHub : la CI n'a tourné qu'en local (mêmes commandes).
- Avertissements `npm audit` (sévérité modérée) hérités des dépendances de l'outillage ; à réévaluer au Lot 7.
