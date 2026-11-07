# mon-app-sport
application de sport

**Adresse de l’application :** https://galianachristian-cpu.github.io/mon-app-sport/

## Mon Garage

L'application Mon Garage a maintenant son propre projet : https://github.com/galianachristian-cpu/mon-garage
(adresse : https://galianachristian-cpu.github.io/mon-garage/). L'ancienne adresse `mon-app-sport/garage/` redirige vers la nouvelle.

## Montée en véhicule (pompiers)

L'application Montée en véhicule du CS Cruzy / Quarante a son propre projet : https://github.com/galianachristian-cpu/monter-vehicule
(adresse : https://galianachristian-cpu.github.io/monter-vehicule/). L'ancienne adresse `mon-app-sport/pompiers/` redirige vers la nouvelle.

## Crédits
- Animations de `img/anim/` (seulement pour les exercices absents de docteur-fitness) : photos de [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) (domaine public, Unlicense), assemblées en GIF.
- Vitamines et minéraux : table de composition nutritionnelle **Ciqual** de l'ANSES (données publiques), repères du jour ANSES 2021. Lait, miel, oignon et une partie du jambon : valeurs moyennes approchées.
- Silhouettes des muscles travaillés (homme et femme, face et dos) : [react-muscle-highlighter](https://github.com/soroojshehryar/react-muscle-highlighter), licence MIT, © 2024 My Muscle Contributors (texte de la licence dans `licences/`).

## Sécurité de la base (connexion obligatoire, version 87)

L'appli demande maintenant une connexion (email + mot de passe Firebase) avant de lire ou
d'enregistrer en ligne. Le téléphone reste connecté ensuite. Mise en place dans la console Firebase :

1. **Authentication → Commencer → Email/Mot de passe** : activer.
2. **Authentication → Utilisateurs → Ajouter un utilisateur** : ton email et un mot de passe
   (le même compte sert sur le téléphone de Béa : les profils Moi et Béa restent séparés dans l'appli).
3. **Authentication → Paramètres → Actions de l'utilisateur** : décocher « Autoriser la création de comptes ».
4. **Firestore Database → Règles** : coller le contenu de `firestore.rules`, puis **Publier**.
   Faire cette étape en dernier, après s'être connecté une fois dans l'appli.
