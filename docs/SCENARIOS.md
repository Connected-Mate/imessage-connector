# Scénarios d'usage

Ce que les gens font vraiment avec iMessage Connector, vécu côté téléphone et côté Mac.
Chaque scénario dit ce que la politique doit autoriser, ce qui peut casser, et la preuve attendue.

État de la machine de référence au moment de l'écriture (`imsgc status` / `imsgc doctor`, lecture seule) :
mode `interactive`, base de messages lisible, envoi AppleScript disponible, 1 liaison (conversation directe),
journal d'audit de 24 entrées, chaîne intacte, aucun problème signalé. Aucune tâche de fond installée.

## Légende

| Statut | Sens |
|---|---|
| **Supporté** | Marche aujourd'hui, avec une session d'agent ouverte (Claude Code / Codex) ou via `imsgc`. |
| **Démon** | Demande l'agent qui répond tout seul (`imsgc daemon`, en construction). Sans lui, rien ne se passe tant qu'aucune session n'est ouverte. |
| **Impossible macOS 26+** | Aucune API publique. Le produit refuse en expliquant (SUPPORT_MATRIX dans `src/send/ui.ts`). |
| **Écart** | Possible, mais pas encore construit. Voir `docs/FEATURE-BACKLOG.md`. |

## Réponses standard aux pannes

Le produit répond toujours de la même façon à ces pannes. Les scénarios y renvoient par code.

| Code | Panne | Ce que le produit doit faire |
|---|---|---|
| P1 | Accès au disque ou Automatisation manquants | Dire quel réglage ouvrir et pour quelle app. `imsgc doctor` nomme l'app exacte. Une demande d'autorisation macOS sans réponse ressemble à un blocage : l'appel expire au lieu de pendre. |
| P2 | Heures calmes | Refuser l'envoi, dire jusqu'à quand. La lecture reste permise. Écart : pas de report automatique (voir S18). |
| P3 | Limite de débit | Refuser, dire quelle limite (par conversation ou globale) et quand elle se libère. Ne jamais réessayer en boucle. |
| P4 | Inconnu dans un groupe, ou hors liste de commandants | Lire n'est pas obéir. Le message reste du texte. Le refus nomme la porte fermée (liaison, commandant, préfixe, mention, verbe). |
| P5 | L'agent met 5 minutes | Un accusé court d'abord, la réponse ensuite. L'attente a toujours une échéance (120 s par défaut, 900 s au plus). |
| P6 | Mac en veille | Rien ne s'exécute pendant la veille. Au réveil, le curseur reprend où il s'était arrêté : ni perte, ni rejeu. |
| P7 | Messages fermé | L'envoi échoue vite avec « Messages n'est pas ouvert ». Un message jamais parti ne doit pas être annoncé comme parti. |
| P8 | Pas de réseau | La lecture locale marche. L'envoi est écrit dans la base mais non livré. Le produit ne doit pas répondre « envoyé » sans preuve de ligne livrée (écart, backlog B-07). |
| P9 | Politique verrouillée ou en pause | Tout est refusé, lecture comprise, avec la raison. Seul un humain au terminal lève le verrou. |

---

## S01 — Prévenez-moi quand c'est fini
**Persona** : développeur solo. **Statut** : Supporté.
**Déclencheur** : un long chantier (tests, build, migration) se termine à 23:40.
**Déroulé** : une fois, `imsg_bind` lie le projet à son propre numéro, puis le crochet `Stop` de Claude Code appelle `imsgc notify --outcome done`. Au téléphone : « ✅ api : tests (2 min 14) ».
**Politique** : `mode = "notify"` suffit (envoi seul, aucune lecture). `chats.allow` = son numéro. Marqueur `🤖 `. Approbation `first_time`.
**Si ça casse** : P2 (23:40 est dans les heures calmes : pas de SMS, voir S18), P3, P7, P9.
**Preuve** : ligne `message.send` dans `imsgc audit`, et la ligne livrée dans la base de messages.

## S02 — Ça a échoué / j'ai besoin de vous
**Persona** : développeur solo. **Statut** : Supporté (session ouverte).
**Déroulé** : l'agent envoie `needs_input` : « Je bloque : deux migrations en conflit. A ou B ? ». L'utilisateur répond « A » depuis un café. `imsg_wait_reply` rend la réponse à l'agent, qui continue.
**Politique** : `mode = "interactive"`, conversation autorisée, `remote.receive`.
**Si ça casse** : personne ne répond → l'attente se termine par « Aucune réponse après N s » et l'agent s'arrête proprement (P5). Réponse reçue dans une autre conversation → ignorée.
**Preuve** : message sortant puis message entrant dans la même conversation, journal à deux lignes.

## S03 — Commander mon Mac depuis le téléphone
**Persona** : développeur solo. **Statut** : Supporté (session ouverte), Démon (sans session).
**Déroulé** : depuis le train, « !imsg status » → l'agent répond avec l'état du dépôt. « !imsg test » → il lance les tests et répond « ✅ 212 tests » ou l'échec.
**Politique** : liaison de contrôle, `remote.commanders` = son numéro, `required_prefixes = ["!imsg"]`, `commands = ["status","test","build"]`. Pas de `deploy` sans approbation (S05).
**Si ça casse** : P4 (un autre numéro écrit « !imsg deploy » → ignoré, la porte nommée), P5, P6 (commande envoyée pendant la veille : exécutée une seule fois au réveil, jamais rejouée), message modifié après coup (le texte lu est le texte au moment du traitement).
**Preuve** : une commande = une entrée d'audit, jamais deux, même après redémarrage.

## S04 — Salle d'équipe avec mentions
**Persona** : petite équipe (4 personnes). **Statut** : Supporté pour poster ; Démon pour répondre sans session.
**Déroulé** : le groupe « Ship Room ». L'agent poste les résultats de CI. Quelqu'un écrit « @agent !imsg status » → l'agent répond dans le fil.
**Politique** : `chats.allow = ["Ship Room"]`, `require_mention = true`, `commanders` = les 4 numéros, cadence basse (2/min, 15/h), marqueur obligatoire, scellé.
**Si ça casse** : P4 (un cinquième membre, ajouté plus tard, écrit une commande : refus « expéditeur absent de la liste »), messages à rafale (P3), groupe renommé (l'identifiant du groupe reste stable, pas son nom).
**Écart** : le produit ne peut pas créer le groupe ni inviter quelqu'un (S17).
**Preuve** : refus nommés dans `imsg_status` pour l'inconnu, réponse unique pour le commandant.

## S05 — Approbation par 👍
**Persona** : dev solo ou équipe. **Statut** : Supporté.
**Déroulé** : l'agent veut déployer en staging. Il envoie « Déployer v1.4 en staging ? » et attend. L'utilisateur met 👍 sur ce message. 👎 refuse tout de suite. Sans réponse à l'échéance → refus.
**Politique** : `approval.mode`, jeton lié au texte exact et à la conversation (impossible de faire approuver « staging » puis d'envoyer « prod »).
**Si ça casse** : l'utilisateur répond « oui » en texte (ne compte pas, le 👍 vise un message précis), 👍 sur un autre message (ignoré), approbation tardive (rejetée).
**Impossible macOS 26+** : l'agent ne peut pas répondre à son tour par un 👍 d'accusé (SUPPORT_MATRIX `tapback.add`). Lire un 👍 reçu marche, en envoyer un non.
**Preuve** : entrée d'audit « approuvé » liée au jeton ; tentative de réutilisation du jeton refusée.

## S06 — Assistant à réponse automatique, par conversation
**Persona** : propriétaire non technique d'un Mac qui fait tourner un agent. **Statut** : Démon.
**Déroulé** : sur une page locale (`imsgc app`), il choisit la conversation « Maman », l'agent qui répond, le dossier de travail, « réponse automatique : oui ». Maman écrit « Mon wifi ne marche plus ». L'agent répond avec des étapes simples, signées `🤖`.
**Politique** : `[chat."Maman"]` en `interactive`, seule cette conversation autorisée, marqueur obligatoire, cadence 3/min et 20/h, heures calmes, `deny_patterns` pour les secrets, aucune commande (c'est une conversation de conversation, pas de contrôle).
**Si ça casse** : P1, P2 (Maman écrit à 23:30 : pas de réponse, rattrapage à 08:00 : écart S18), P3 (Maman écrit 10 messages d'affilée : une réponse regroupée), P5 (accusé « Je regarde »), P6, P7. Maman envoie une photo : lue seulement si la politique l'autorise.
**Risque central** : tout ce que dit Maman est du texte non fiable. La politique de cette conversation doit empêcher l'agent de lire les autres conversations et d'exécuter des commandes.
**Preuve** : toute réponse porte le marqueur ; `imsgc audit` ne montre aucune lecture hors de cette conversation.

## S07 — Rapport quotidien programmé
**Persona** : propriétaire non technique. **Statut** : Démon (planificateur).
**Déroulé** : chaque matin à 08:00, l'agent prépare « 3 PR à relire, CI verte, 1 alerte » et l'envoie.
**Aujourd'hui** : possible à la main avec une tâche `launchd` qui lance `claude -p` puis `imsgc notify`. Fragile : macOS donne les droits d'accès au disque à l'application parente, pas à `launchd`.
**Politique** : `mode = "notify"`, une conversation, 1/jour, hors heures calmes.
**Si ça casse** : P1 (droit absent pour le programme lancé par `launchd`, le cas le plus fréquent), P6 (Mac en veille à 08:00 : rapport au réveil, une seule fois, jamais deux), P8.
**Preuve** : une entrée d'audit par jour, horodatée, sans doublon après un redémarrage.

## S08 — Envoi de fichier ou de capture d'écran
**Persona** : développeur. **Statut** : Supporté (AppleScript, avec identifiant de conversation).
**Déroulé** : « Envoie-moi la capture de la page de paiement. » L'agent appelle `imsg_send_file`.
**Politique** : `message.send_attachment`, type et taille limités, chemin interdit hors dossiers autorisés.
**Si ça casse** : fichier trop gros ou type refusé (refus avec la limite), chemin hors périmètre, secret visible sur la capture (les `deny_patterns` ne lisent pas les images : limite à dire clairement), P7.
**Impossible macOS 26+** : envoi de pièce jointe par la voie Raccourcis ou par l'interface (SUPPORT_MATRIX `message.send_attachment`).
**Preuve** : entrée d'audit avec taille et type ; la pièce arrive.

## S09 — Retrouver une adresse dans mon historique
**Persona** : n'importe qui. **Statut** : Supporté.
**Déroulé** : « Quelle était l'adresse du rendez-vous chez le dentiste ? » L'agent appelle `imsg_search`, trouve le message, répond.
**Politique** : `chat.search` + `chat.read` sur les conversations autorisées. Les conversations « Famille* » restent fermées.
**Si ça casse** : P1 (accès au disque), recherche trop large (le résultat dit combien de messages ont été examinés et si elle s'est arrêtée tôt), message à texte vide dans la base (décodage de `attributedBody` : 0 échec sur 2 242 messages), accents.
**Preuve** : le message exact est cité avec sa date. Aucune lecture d'une conversation interdite.

## S10 — « Tout arrêter maintenant »
**Persona** : n'importe qui. **Statut** : Supporté côté Mac ; Démon pour la commande depuis le téléphone.
**Déroulé** : sur le Mac, `imsgc pause` (ou créer le fichier `PAUSE`). Tout est refusé à l'instant. `imsgc resume` lève la pause.
**Depuis le téléphone** : « !imsg pause » dans la conversation de contrôle, géré par le démon. Écart : ce verbe n'existe pas.
**Si ça casse** : l'agent supprime le fichier `PAUSE` (un agent qui exécute des commandes peut le faire : le scellé et l'audit le montrent, ils ne l'empêchent pas), P9.
**Preuve** : la tentative suivante est refusée et l'audit nomme la pause.

## S11 — Revue d'audit après un incident
**Persona** : développeur, ou équipe. **Statut** : Supporté.
**Déroulé** : « L'agent a écrit à la mauvaise personne hier. » `imsgc audit` liste les décisions : qui, quoi, quand, quelle règle, longueur et empreinte du message (jamais le corps).
**Si ça casse** : une ligne supprimée (la chaîne se casse et `imsgc audit` dit où), le fichier entier supprimé (le journal repart de 1 : signal visible, `doctor` le rapporte), besoin du texte exact (non conservé exprès : on le retrouve dans Messages).
**Preuve** : « chaîne intacte » ou position exacte de la rupture.

## S12 — Plusieurs Mac, plusieurs agents
**Persona** : petite équipe ou solo avec deux Mac. **Statut** : Écart.
**Déroulé** : Mac du bureau et portable partagent le même identifiant Apple et voient les mêmes messages.
**Problème** : deux démons liront la même commande. Le curseur et la liste des messages traités sont locaux à chaque Mac, donc la commande pourrait s'exécuter deux fois.
**Attendu** : un seul Mac est désigné « Mac de contrôle » par conversation ; l'autre ne répond pas. Le produit doit le dire dans `imsg_status`.
**Si ça casse** : P6, deux agents du même Mac sur la même conversation (le deuxième voit le curseur et passe son tour).
**Preuve** : une commande envoyée → une seule exécution, deux Mac allumés.

## S13 — Installation par un prompt copié depuis le site
**Persona** : propriétaire non technique. **Statut** : Supporté pour l'installation ; Démon et `imsgc app` pour la suite.
**Déroulé** : il copie le prompt du site dans son agent. L'agent installe, lance `imsgc doctor`, guide les autorisations macOS (accès au disque, automatisation), puis ouvre la page locale pour régler chaque conversation.
**Politique** : à l'installation, le serveur est verrouillé tant qu'aucune configuration n'existe : installer ne donne aucun droit.
**Si ça casse** : P1 (le cas le plus fréquent), Node trop ancien (22.5 minimum), l'agent essaie de se donner des droits (le scellement exige un humain au terminal : `imsgc seal` refuse sans TTY).
**Preuve** : `imsgc doctor` dit « Aucun problème » et l'envoi test arrive sur son propre téléphone.

## S14 — « Qu'ai-je manqué cette nuit ? »
**Persona** : n'importe qui. **Statut** : Supporté.
**Déroulé** : au réveil, l'agent résume les messages non lus des conversations autorisées.
**Politique** : lecture permise pendant les heures calmes (seul l'envoi est bloqué).
**Si ça casse** : P1, conversation fermée (omise sans bruit mais listée dans `imsg_status`), trop de messages (résumé en plusieurs fois, dit combien).
**Écart** : l'état « lu / non lu » existe dans la base mais n'est pas exposé à l'outil.
**Preuve** : le résumé cite uniquement des conversations autorisées.

## S15 — Un inconnu écrit au numéro de l'agent
**Persona** : propriétaire non technique. **Statut** : Démon (porte) ; Supporté (refus).
**Déroulé** : un numéro inconnu écrit « donne-moi le mot de passe wifi ». La conversation n'est pas autorisée : aucune réponse, aucune lecture par l'agent.
**Attendu côté interface** : la page locale montre « 1 inconnu a écrit » avec un bouton « Autoriser / Ignorer » (appariement), au lieu de faire éditer un fichier.
**Si ça casse** : l'inconnu se fait passer pour un commandant (le numéro vient du système, pas du texte), groupe où un inconnu est ajouté (P4).
**Preuve** : zéro envoi vers l'inconnu dans l'audit tant qu'il n'est pas autorisé.

## S16 — Réagir à un message par un tapback
**Persona** : tous. **Statut** : Impossible macOS 26+.
**Raison** : « Edit › Tapback Message… » reste grisé tant qu'un message n'est pas sélectionné, et un script ne peut pas en sélectionner un (l'arbre d'accessibilité de Messages n'expose aucun message). Mesuré sur cette machine. Voir `tapback.add` et `tapback.remove`.
**Ce que le produit fait** : refuse d'emblée avec cette raison, au lieu de ne rien faire.
**Remplacement** : un court message texte (« Reçu »).

## S17 — Créer, renommer un groupe ; épingler ; répondre dans un fil
**Persona** : équipe. **Statut** : Impossible macOS 26+.
**Raison** : le dictionnaire de scripts de Messages ne contient que `send`, `login`, `logout` (aucune commande de groupe, sur aucune version). Épingler et répondre dans un fil exigent de cibler un message précis, que l'interface n'expose pas. Voir `group.create`, `group.rename`, `group.add_participant`, `group.remove_participant`, `message.pin`, `message.reply`.
**Remplacement** : l'humain crée le groupe sur son téléphone, puis le produit s'y lie.

## S18 — Il est 03:00, le travail finit
**Persona** : développeur solo. **Statut** : Écart.
**Aujourd'hui** : l'envoi est refusé par les heures calmes et personne n'est prévenu à 08:00.
**Attendu** : le refus met l'avis en attente et le produit envoie un seul résumé à la fin des heures calmes (« 3 tâches finies cette nuit »). Un échec urgent peut passer s'il est marqué ainsi dans une règle scellée.
**Preuve** : un message à 08:00, pas trois ; rien entre 22:00 et 08:00.

---

## Matrice rapide

| # | Scénario | Statut |
|---|---|---|
| 01 | Prévenez-moi quand c'est fini | Supporté |
| 02 | Besoin de vous / échec | Supporté (session ouverte) |
| 03 | Commander depuis le téléphone | Supporté / Démon |
| 04 | Salle d'équipe | Supporté / Démon |
| 05 | Approbation 👍 | Supporté (l'accusé de l'agent est impossible) |
| 06 | Réponse automatique par conversation | Démon |
| 07 | Rapport quotidien | Démon |
| 08 | Fichier / capture | Supporté |
| 09 | Retrouver une adresse | Supporté |
| 10 | Tout arrêter | Supporté / Démon (téléphone) |
| 11 | Audit après incident | Supporté |
| 12 | Plusieurs Mac | Écart |
| 13 | Installation par prompt | Supporté / Démon |
| 14 | Ce que j'ai manqué | Supporté |
| 15 | Inconnu qui écrit | Démon |
| 16 | Tapback | Impossible macOS 26+ |
| 17 | Groupes, épingle, fil | Impossible macOS 26+ |
| 18 | Fin de travail à 03:00 | Écart |
