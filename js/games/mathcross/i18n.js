// games/mathcross/i18n.js — die TEXTE, die Math Cross anders braucht als die
// gemeinsame Schale: eigene Schlüssel (Markier-Werkzeuge, Geteilt-Zeichen,
// Zieh-Reichweite, Trainings-Schritte …) und abweichende Fassungen (Anleitung,
// Erfolgs-Beschreibungen, Einladungstexte). Liegt als Ebene ÜBER den gemeinsamen
// Texten (js/i18n/), solange Math Cross das aktive Spiel ist — s. setGameMessages.
// Erzeugt aus den Sprachdateien von Coop Math Cross; die Werte sind unverändert.

export default {
  "de": {
    "diffShift": {
      "toast": "Die Schwierigkeiten sind eine Stufe nach unten gerückt und oben wartet ein neues, härteres R.I.P. — deine Statistiken sind mitgewandert."
    },
    "game": {
      "markMode": "Markierungsmodus",
      "markTools": "Markieren",
      "clearMarks": "Alle Markierungen löschen",
      "clearMarksTitle": "Alle Markierungen löschen?",
      "clearMarksMsg": "{n} Markierungen werden entfernt. Das lässt sich nicht rückgängig machen."
    },
    "soloInvite": {
      "shareText": "Spiel mit mir Math Cross! Tritt meinem laufenden Spiel bei – Raumcode: {code}"
    },
    "settings": {
      "divStyle": "Geteilt-Zeichen",
      "divStyleAsk": "Wie soll „geteilt durch“ auf dem Brett aussehen?",
      "divStyleHint": "Reine Anzeige — die Rätsel bleiben identisch. Jederzeit hier änderbar.",
      "div_obelus": "Obelus",
      "div_colon": "Doppelpunkt",
      "div_slash": "Schrägstrich",
      "divExample": "z. B. 12 {sym} 3 = 4",
      "sfxChat": "Chat-Nachricht",
      "dragScale": "Reichweite beim Ziehen",
      "dragScaleHint": "Der gezogene Stein folgt deinem Finger verstärkt: Bei 3x schiebt eine kurze Bewegung ihn dreimal so weit — so erreichst du den oberen Brettrand, ohne den Finger über den ganzen Bildschirm zu ziehen. Abgelegt wird immer dort, wo der Stein zu sehen ist.",
      "dragScaleOff": "1x (aus)",
      "dragScaleOn": "{f}x",
      "colorBlindModeHint": "Ersetzt Grün/Rot im gesamten Spiel (richtig/falsch, Leben, Coop-Farben, ...) durch besser unterscheidbare Töne für Rot-Grün-/Blau-Gelb-Sehschwäche.",
      "markColor": "Markierungsfarbe",
      "markColorHint": "Farbe für eigene Notiz-Markierungen: ein Feld lange gedrückt halten hebt es hervor. Die Markierung hat keine Bedeutung fürs Rätsel — du legst selbst fest, wofür du sie nutzt. Nur du siehst sie."
    },
    "prestige": {
      "master": {
        "desc": "Das ultimative Abzeichen — freigeschaltet, wenn ALLE 12 Abzeichen auf Legendär stehen. Der Beweis, dass du Math Cross gemeistert hast."
      }
    },
    "training": {
      "title": "Nächster Schritt",
      "apply": "Verstanden – ausführen",
      "step": {
        "direct": "In dieser Rechnung fehlt nur eine Zahl: {eq} → die {v}."
      }
    },
    "achievements": {
      "perfectWin": {
        "desc": "Löse ein Rätsel ohne einen einzigen Fehler."
      },
      "perfectTen": {
        "desc": "Gewinne 10 Rätsel ohne Fehler."
      },
      "bigPerfect": {
        "desc": "Gewinne ein „Große Zahlen“-Rätsel ohne Fehler."
      }
    },
    "share": {
      "coopInvite": "Spiel mit mir Coop Math Cross im Coop-Modus! Code: {code} — {url}"
    },
    "howto": {
      "rule1": "Setze die Zahlen aus dem <b>Vorrat</b> unten in die leeren Felder — entweder <b>hinziehen</b> oder die Zahl <b>antippen</b> und dann auf das Feld tippen.",
      "rule2": "Jede waagerechte und senkrechte <b>Rechnung</b> muss aufgehen — z. B. <b>7 × 3 = 21</b>.",
      "rule3": "Es gibt nur <b>ganze Zahlen</b> ohne Komma, und ein <b>Ergebnis</b> ist nie negativ. <b>Zwischenschritte</b> dürfen es sehr wohl sein: <b>1 − 4 + 7 = 4</b> geht in Ordnung.",
      "rule4": "Zwei gelegte Steine <b>tauschen</b> den Platz: einen antippen (er bleibt ausgewählt), dann den anderen antippen. Ziehen geht genauso.",
      "ruleTapBack": "<b>Dreimal</b> auf einen gelegten Stein tippen schickt ihn zurück in den Vorrat.",
      "ruleMark": "Ein Feld <b>lange gedrückt halten</b> markiert es farbig. Das ist nur eine Notiz für dich: es bedeutet nichts fürs Rätsel, niemand sonst sieht es — wofür du es nutzt, entscheidest du. Die Farbe wählst du in den Einstellungen. Willst du mehrere Felder hintereinander markieren, schalte oben den <b>Markierungsmodus</b> ein (Pinsel-Knopf): dort genügt ein <b>einfacher Tipp</b> pro Feld, dafür lassen sich solange keine Zahlen anfassen.",
      "rule5": "Der Vorrat enthält <b>exakt</b> die fehlenden Zahlen — bleibt am Ende etwas übrig, liegt etwas falsch.",
      "rule6": "Jedes Rätsel ist <b>ohne Raten</b> eindeutig lösbar. Ein <b>Fehler</b> ist nur, wenn ein Stein eine Rechnung vollständig macht, die dann nicht aufgeht — das kostet ein Leben. Einen Stein auf ein Feld zu legen, auf das am Ende eine <b>andere</b> Zahl gehört, ist also <b>kein</b> Fehler — solange die Rechnung noch eine Lücke hat, passiert nichts. Du darfst also in Ruhe ausprobieren.",
      "rule7Coop": "Im Coop teilt ihr euch die <b>Leben</b> — ein verbrauchtes Herz wird in der Farbe des Spielers durchgestrichen, der den Fehler gemacht hat.",
      "rule9": "Eine <b>Bestzeit</b> zählt nur bei einem <b>fehlerfreien</b> Spiel — nach einem Fehler wirst du im Spiel und am Ende darauf hingewiesen."
    },
    "a11y": {
      "cellLabel": "Zeile {row}, Spalte {col}, {status}",
      "cellGiven": "vorgegeben",
      "cellEmpty": "leer",
      "cellFilled": "belegt mit {value}"
    }
  },
  "en": {
    "diffShift": {
      "toast": "Every difficulty moved down one step and a new, harder R.I.P. waits at the top — your stats moved along with them."
    },
    "game": {
      "markMode": "Marking mode",
      "markTools": "Marking",
      "clearMarks": "Clear all marks",
      "clearMarksTitle": "Clear all marks?",
      "clearMarksMsg": "{n} marks will be removed. This cannot be undone."
    },
    "soloInvite": {
      "shareText": "Play Math Cross with me! Join my running game – room code: {code}"
    },
    "settings": {
      "divStyle": "Division sign",
      "divStyleAsk": "How should “divided by” look on the board?",
      "divStyleHint": "Display only — the puzzles stay identical. Changeable here at any time.",
      "div_obelus": "Obelus",
      "div_colon": "Colon",
      "div_slash": "Slash",
      "divExample": "e.g. 12 {sym} 3 = 4",
      "sfxChat": "Chat message",
      "dragScale": "Drag reach",
      "dragScaleHint": "The tile you drag follows your finger amplified: at 3x a short move sends it three times as far, so you reach the top of the board without dragging across the whole screen. It always drops where the tile is shown.",
      "dragScaleOff": "1x (off)",
      "dragScaleOn": "{f}x",
      "colorBlindModeHint": "Replaces green/red everywhere in the game (correct/wrong, lives, co-op colors, ...) with more distinguishable tones for red-green/blue-yellow color vision deficiency.",
      "markColor": "Highlight color",
      "markColorHint": "Color for your own note markers: press and hold a cell to highlight it. The marker means nothing to the puzzle — you decide what you use it for. Only you can see it."
    },
    "prestige": {
      "master": {
        "desc": "The ultimate badge — unlocked when ALL 12 badges reach Legendary. Proof that you have mastered Math Cross."
      }
    },
    "training": {
      "title": "Next step",
      "apply": "Got it – apply",
      "step": {
        "direct": "Only one number is missing in this equation: {eq} → the {v}."
      }
    },
    "achievements": {
      "perfectWin": {
        "desc": "Solve a puzzle with no mistakes at all."
      },
      "perfectTen": {
        "desc": "Win 10 puzzles with no mistakes."
      },
      "bigPerfect": {
        "desc": "Win a Big Numbers puzzle with no mistakes."
      }
    },
    "share": {
      "coopInvite": "Play Coop Math Cross with me in co-op mode! Code: {code} — {url}"
    },
    "howto": {
      "rule1": "Place the numbers from the <b>tray</b> below into the empty cells — either <b>drag</b> them or <b>tap</b> a number and then tap the cell.",
      "rule2": "Every horizontal and vertical <b>equation</b> has to work out — e.g. <b>7 × 3 = 21</b>.",
      "rule3": "Only <b>whole numbers</b>, never a decimal, and a <b>result</b> is never negative. <b>Intermediate steps</b> may well be: <b>1 − 4 + 7 = 4</b> is fine.",
      "rule4": "Two placed tiles <b>swap</b>: tap one (it stays selected), then tap the other. Dragging works just as well.",
      "ruleTapBack": "Tapping a placed tile <b>three times</b> sends it back to the tray.",
      "ruleMark": "<b>Press and hold</b> a cell to highlight it. That is just a note for you: it means nothing to the puzzle, nobody else sees it — what you use it for is up to you. Pick the color in the settings. To mark several squares in a row, switch on <b>marking mode</b> at the top (brush button): there a <b>single tap</b> per square is enough, and numbers stay untouchable while it is on.",
      "rule5": "The tray holds <b>exactly</b> the missing numbers — if tiles are left over, something is in the wrong place.",
      "rule6": "Every puzzle is uniquely solvable <b>without guessing</b>. A <b>mistake</b> is only made when a tile completes an equation that then does not work out — that costs a life. So putting a tile on a square where a <b>different</b> number belongs in the end is <b>not</b> a mistake — as long as the equation still has a gap, nothing happens. Feel free to try things out.",
      "rule7Coop": "In co-op you share the <b>lives</b> — a lost life is struck through in the color of the player who made the mistake.",
      "rule9": "A <b>best time</b> only counts for a <b>flawless</b> game — after a mistake you are told during and at the end of the game."
    },
    "a11y": {
      "cellLabel": "Row {row}, column {col}, {status}",
      "cellGiven": "given",
      "cellEmpty": "empty",
      "cellFilled": "holds {value}"
    }
  },
  "es": {
    "diffShift": {
      "toast": "Cada dificultad ha bajado un escalón y arriba espera un R.I.P. nuevo y más duro: tus estadísticas se han movido con ellas."
    },
    "game": {
      "markMode": "Modo de marcado",
      "markTools": "Marcar",
      "clearMarks": "Borrar todas las marcas",
      "clearMarksTitle": "¿Borrar todas las marcas?",
      "clearMarksMsg": "Se eliminarán {n} marcas. Esto no se puede deshacer."
    },
    "soloInvite": {
      "shareText": "¡Juega Math Cross conmigo! Únete a mi partida en curso – código de sala: {code}"
    },
    "settings": {
      "divStyle": "Signo de división",
      "divStyleAsk": "¿Cómo quieres que se vea «dividido por» en el tablero?",
      "divStyleHint": "Solo visual: los rompecabezas no cambian. Puedes cambiarlo aquí cuando quieras.",
      "div_obelus": "Óbelo",
      "div_colon": "Dos puntos",
      "div_slash": "Barra",
      "divExample": "p. ej. 12 {sym} 3 = 4",
      "sfxChat": "Mensaje de chat",
      "dragScale": "Alcance al arrastrar",
      "dragScaleHint": "La ficha que arrastras sigue tu dedo amplificada: con 3x un movimiento corto la lleva tres veces más lejos, así llegas al borde superior sin recorrer toda la pantalla. Siempre se coloca donde se ve la ficha.",
      "dragScaleOff": "1x (desactivado)",
      "dragScaleOn": "{f}x",
      "colorBlindModeHint": "Sustituye el verde/rojo en todo el juego (correcto/incorrecto, vidas, colores cooperativos, ...) por tonos más distinguibles para la discapacidad visual rojo-verde/azul-amarillo.",
      "markColor": "Color de marca",
      "markColorHint": "Color de tus marcas personales: mantén pulsada una casilla para resaltarla. La marca no significa nada para el puzle: tú decides para qué la usas. Solo tú la ves."
    },
    "prestige": {
      "master": {
        "desc": "The ultimate badge — unlocked when ALL 12 badges reach Legendary. Proof that you have mastered Math Cross."
      }
    },
    "training": {
      "title": "Siguiente paso",
      "apply": "Entendido: aplicar",
      "step": {
        "direct": "En esta operación falta un solo número: {eq} → el {v}."
      }
    },
    "achievements": {
      "perfectWin": {
        "desc": "Resuelve un rompecabezas sin ningún error."
      },
      "perfectTen": {
        "desc": "Gana 10 rompecabezas sin errores."
      },
      "bigPerfect": {
        "desc": "Gana un puzle de Números grandes sin errores."
      }
    },
    "share": {
      "coopInvite": "¡Juega Coop Math Cross conmigo en modo cooperativo! Código: {code} — {url}"
    },
    "howto": {
      "rule1": "Coloca los números del <b>montón</b> de abajo en las casillas vacías: <b>arrástralos</b> o <b>toca</b> un número y luego la casilla.",
      "rule2": "Cada <b>operación</b> horizontal y vertical debe cuadrar, p. ej. <b>7 × 3 = 21</b>.",
      "rule3": "Solo <b>números enteros</b>, nunca decimales, y un <b>resultado</b> nunca es negativo. Los <b>pasos intermedios</b> sí pueden serlo: <b>1 − 4 + 7 = 4</b> es válido.",
      "rule4": "Dos fichas colocadas se <b>intercambian</b>: toca una (queda seleccionada) y luego la otra. Arrastrar funciona igual.",
      "ruleTapBack": "Tocar <b>tres veces</b> una ficha colocada la devuelve al montón.",
      "ruleMark": "<b>Mantén pulsada</b> una casilla para resaltarla. Es solo una nota tuya: no significa nada para el puzle y nadie más la ve; tú decides para qué usarla. El color se elige en los ajustes. Para marcar varias casillas seguidas, activa arriba el <b>modo de marcado</b> (botón del pincel): allí basta <b>un toque</b> por casilla, pero mientras esté activo no puedes mover números.",
      "rule5": "El montón contiene <b>exactamente</b> los números que faltan: si sobra alguno, algo está mal colocado.",
      "rule6": "Cada rompecabezas tiene una solución única <b>sin adivinar</b>. Solo es un <b>error</b> cuando una ficha completa una operación que no cuadra: eso cuesta una vida. Por eso, colocar una ficha en una casilla donde al final va <b>otro</b> número <b>no</b> es un error: mientras la operación tenga un hueco, no pasa nada. Puedes probar con tranquilidad.",
      "rule7Coop": "En cooperativo compartís las <b>vidas</b>: una vida perdida se tacha con el color del jugador que cometió el error.",
      "rule9": "Un <b>mejor tiempo</b> solo cuenta en una partida <b>sin errores</b>: tras un error se te avisa durante la partida y al final."
    },
    "a11y": {
      "cellLabel": "Fila {row}, columna {col}, {status}",
      "cellGiven": "dado",
      "cellEmpty": "vacío",
      "cellFilled": "contiene {value}"
    }
  },
  "fr": {
    "diffShift": {
      "toast": "Chaque difficulté a reculé d'un cran et un R.I.P. tout neuf, plus dur, attend en haut — tes statistiques ont suivi."
    },
    "game": {
      "markMode": "Mode marquage",
      "markTools": "Marquage",
      "clearMarks": "Effacer toutes les marques",
      "clearMarksTitle": "Effacer toutes les marques ?",
      "clearMarksMsg": "{n} marques seront supprimées. Cette action est irréversible."
    },
    "soloInvite": {
      "shareText": "Joue à Math Cross avec moi ! Rejoins ma partie en cours – code du salon : {code}"
    },
    "settings": {
      "divStyle": "Signe de division",
      "divStyleAsk": "À quoi doit ressembler « divisé par » sur la grille ?",
      "divStyleHint": "Affichage seulement — les grilles restent identiques. Modifiable ici à tout moment.",
      "div_obelus": "Obèle",
      "div_colon": "Deux-points",
      "div_slash": "Barre oblique",
      "divExample": "ex. 12 {sym} 3 = 4",
      "sfxChat": "Message de chat",
      "dragScale": "Portée du glisser",
      "dragScaleHint": "La tuile déplacée suit votre doigt de façon amplifiée : à 3x, un petit geste la déplace trois fois plus loin, vous atteignez le haut de la grille sans traverser tout l'écran. Elle est posée là où elle est affichée.",
      "dragScaleOff": "1x (désactivé)",
      "dragScaleOn": "{f}x",
      "colorBlindModeHint": "Remplace le vert/rouge partout dans le jeu (correct/incorrect, vies, couleurs coop, ...) par des teintes plus distinguables pour la déficience visuelle rouge-vert/bleu-jaune.",
      "markColor": "Couleur de repère",
      "markColorHint": "Couleur de tes repères personnels : appuie longuement sur une case pour la mettre en évidence. Le repère n'a aucun sens pour la grille — à toi de décider à quoi il sert. Toi seul le vois."
    },
    "prestige": {
      "master": {
        "desc": "The ultimate badge — unlocked when ALL 12 badges reach Legendary. Proof that you have mastered Math Cross."
      }
    },
    "training": {
      "title": "Étape suivante",
      "apply": "Compris – appliquer",
      "step": {
        "direct": "Il ne manque qu’un nombre dans ce calcul : {eq} → le {v}."
      }
    },
    "achievements": {
      "perfectWin": {
        "desc": "Résous un puzzle sans la moindre erreur."
      },
      "perfectTen": {
        "desc": "Gagne 10 puzzles sans erreur."
      },
      "bigPerfect": {
        "desc": "Gagne une grille Grands nombres sans erreur."
      }
    },
    "share": {
      "coopInvite": "Joue à Coop Math Cross avec moi en mode coopératif ! Code : {code} — {url}"
    },
    "howto": {
      "rule1": "Place les nombres de la <b>réserve</b> en bas dans les cases vides : <b>fais-les glisser</b> ou <b>touche</b> un nombre puis la case.",
      "rule2": "Chaque <b>calcul</b> horizontal et vertical doit être juste, p. ex. <b>7 × 3 = 21</b>.",
      "rule3": "Uniquement des <b>nombres entiers</b>, jamais de virgule, et un <b>résultat</b> n'est jamais négatif. Les <b>étapes intermédiaires</b>, elles, peuvent l'être : <b>1 − 4 + 7 = 4</b> est valable.",
      "rule4": "Deux tuiles posées <b>échangent</b> leur place : touche la première (elle reste sélectionnée), puis la seconde. Le glisser-déposer marche aussi.",
      "ruleTapBack": "Toucher <b>trois fois</b> une tuile posée la renvoie dans la réserve.",
      "ruleMark": "<b>Appuie longuement</b> sur une case pour la mettre en évidence. Ce n'est qu'une note pour toi : cela ne change rien à la grille et personne d'autre ne le voit — à toi de décider à quoi ça sert. La couleur se choisit dans les réglages. Pour marquer plusieurs cases d’affilée, active en haut le <b>mode marquage</b> (bouton pinceau) : une <b>simple pression</b> par case suffit, mais les nombres restent intouchables tant qu’il est actif.",
      "rule5": "La réserve contient <b>exactement</b> les nombres manquants : s’il en reste, quelque chose est mal placé.",
      "rule6": "Chaque grille a une solution unique, <b>sans deviner</b>. Il n’y a <b>erreur</b> que si une tuile complète un calcul qui ne tombe pas juste — cela coûte une vie. Poser une tuile sur une case où un <b>autre</b> nombre ira finalement n’est donc <b>pas</b> une erreur : tant que le calcul a encore un trou, il ne se passe rien. Tu peux essayer tranquillement.",
      "rule7Coop": "En coop, vous partagez les <b>vies</b> — une vie perdue est barrée dans la couleur du joueur ayant fait l'erreur.",
      "rule9": "Un <b>meilleur temps</b> ne compte que pour une partie <b>sans erreur</b> : après une erreur, tu es prévenu pendant et à la fin de la partie."
    },
    "a11y": {
      "cellLabel": "Ligne {row}, colonne {col}, {status}",
      "cellGiven": "donné",
      "cellEmpty": "vide",
      "cellFilled": "contient {value}"
    }
  },
  "pt-BR": {
    "diffShift": {
      "toast": "Cada dificuldade desceu um degrau e no topo espera um R.I.P. novo e mais duro — suas estatísticas foram junto."
    },
    "game": {
      "markMode": "Modo de marcação",
      "markTools": "Marcação",
      "clearMarks": "Apagar todas as marcações",
      "clearMarksTitle": "Apagar todas as marcações?",
      "clearMarksMsg": "{n} marcações serão removidas. Não é possível desfazer."
    },
    "soloInvite": {
      "shareText": "Jogue Math Cross comigo! Entre no meu jogo em andamento – código da sala: {code}"
    },
    "settings": {
      "divStyle": "Sinal de divisão",
      "divStyleAsk": "Como “dividido por” deve aparecer no tabuleiro?",
      "divStyleHint": "Apenas visual: os quebra-cabeças não mudam. Alterável aqui a qualquer momento.",
      "div_obelus": "Óbelo",
      "div_colon": "Dois-pontos",
      "div_slash": "Barra",
      "divExample": "ex.: 12 {sym} 3 = 4",
      "sfxChat": "Mensagem de chat",
      "dragScale": "Alcance ao arrastar",
      "dragScaleHint": "A peça arrastada segue seu dedo de forma amplificada: em 3x um movimento curto a leva três vezes mais longe, então você alcança o topo do tabuleiro sem percorrer a tela inteira. Ela é colocada onde aparece.",
      "dragScaleOff": "1x (desligado)",
      "dragScaleOn": "{f}x",
      "colorBlindModeHint": "Substitui o verde/vermelho em todo o jogo (certo/errado, vidas, cores do coop, ...) por tons mais distinguíveis para deficiência visual vermelho-verde/azul-amarelo.",
      "markColor": "Cor da marcação",
      "markColorHint": "Cor das suas marcações pessoais: mantenha uma casa pressionada para destacá-la. A marcação não significa nada para o quebra-cabeça — você decide para que serve. Só você a vê."
    },
    "prestige": {
      "master": {
        "desc": "The ultimate badge — unlocked when ALL 12 badges reach Legendary. Proof that you have mastered Math Cross."
      }
    },
    "training": {
      "title": "Próximo passo",
      "apply": "Entendi – aplicar",
      "step": {
        "direct": "Falta só um número nesta conta: {eq} → o {v}."
      }
    },
    "achievements": {
      "perfectWin": {
        "desc": "Resolva um quebra-cabeça sem nenhum erro."
      },
      "perfectTen": {
        "desc": "Vença 10 quebra-cabeças sem erros."
      },
      "bigPerfect": {
        "desc": "Vença um quebra-cabeça de Números grandes sem erros."
      }
    },
    "share": {
      "coopInvite": "Jogue Coop Math Cross comigo no modo cooperativo! Código: {code} — {url}"
    },
    "howto": {
      "rule1": "Coloque os números da <b>reserva</b> abaixo nas casas vazias: <b>arraste</b> ou <b>toque</b> num número e depois na casa.",
      "rule2": "Toda <b>conta</b> horizontal e vertical precisa fechar, p. ex. <b>7 × 3 = 21</b>.",
      "rule3": "Somente <b>números inteiros</b>, nunca vírgula, e um <b>resultado</b> nunca é negativo. Os <b>passos intermediários</b> podem ser: <b>1 − 4 + 7 = 4</b> vale.",
      "rule4": "Duas peças colocadas <b>trocam</b> de lugar: toque numa (ela fica selecionada) e depois na outra. Arrastar funciona igual.",
      "ruleTapBack": "Tocar <b>três vezes</b> numa peça colocada a devolve à reserva.",
      "ruleMark": "<b>Mantenha uma casa pressionada</b> para destacá-la. É só uma anotação sua: não significa nada para o quebra-cabeça e mais ninguém vê — você decide para que serve. A cor se escolhe nos ajustes. Para marcar várias casas seguidas, ative em cima o <b>modo de marcação</b> (botão do pincel): ali basta <b>um toque</b> por casa, mas enquanto estiver ativo não dá para mexer nos números.",
      "rule5": "A reserva tem <b>exatamente</b> os números que faltam: se sobrar alguma peça, algo está no lugar errado.",
      "rule6": "Cada desafio tem solução única, <b>sem chute</b>. Só é <b>erro</b> quando uma peça completa uma conta que não fecha — isso custa uma vida. Então colocar uma peça numa casa onde no fim vai <b>outro</b> número <b>não</b> é erro: enquanto a conta ainda tiver uma lacuna, nada acontece. Pode testar à vontade.",
      "rule7Coop": "No coop vocês dividem as <b>vidas</b>: uma vida perdida é riscada na cor do jogador que errou.",
      "rule9": "Um <b>melhor tempo</b> só conta em uma partida <b>sem erros</b>: após um erro, você é avisado durante e ao final da partida."
    },
    "a11y": {
      "cellLabel": "Linha {row}, coluna {col}, {status}",
      "cellGiven": "dado",
      "cellEmpty": "vazio",
      "cellFilled": "contém {value}"
    }
  },
  "it": {
    "diffShift": {
      "toast": "Ogni difficoltà è scesa di un gradino e in cima ti aspetta un R.I.P. nuovo e più duro: le tue statistiche si sono spostate con loro."
    },
    "game": {
      "markMode": "Modalità marcatura",
      "markTools": "Marcatura",
      "clearMarks": "Cancella tutte le marcature",
      "clearMarksTitle": "Cancellare tutte le marcature?",
      "clearMarksMsg": "Verranno rimosse {n} marcature. L’operazione non è annullabile."
    },
    "soloInvite": {
      "shareText": "Gioca a Math Cross con me! Unisciti alla mia partita in corso – codice stanza: {code}"
    },
    "settings": {
      "divStyle": "Segno di divisione",
      "divStyleAsk": "Come deve apparire «diviso» sulla griglia?",
      "divStyleHint": "Solo visivo: gli schemi restano identici. Modificabile qui in qualsiasi momento.",
      "div_obelus": "Obelo",
      "div_colon": "Due punti",
      "div_slash": "Barra",
      "divExample": "es. 12 {sym} 3 = 4",
      "sfxChat": "Messaggio in chat",
      "dragScale": "Portata del trascinamento",
      "dragScaleHint": "La tessera trascinata segue il dito amplificata: a 3x un piccolo movimento la sposta tre volte più lontano, così raggiungi il bordo superiore senza attraversare tutto lo schermo. Viene posata dove la vedi.",
      "dragScaleOff": "1x (off)",
      "dragScaleOn": "{f}x",
      "colorBlindModeHint": "Sostituisce il verde/rosso in tutto il gioco (corretto/errato, vite, colori co-op, ...) con tonalità più distinguibili per il deficit visivo rosso-verde/blu-giallo.",
      "markColor": "Colore del segno",
      "markColorHint": "Colore dei tuoi segni personali: tieni premuta una casella per evidenziarla. Il segno non ha alcun significato per il puzzle: decidi tu a cosa serve. Lo vedi solo tu."
    },
    "prestige": {
      "master": {
        "desc": "The ultimate badge — unlocked when ALL 12 badges reach Legendary. Proof that you have mastered Math Cross."
      }
    },
    "training": {
      "title": "Prossimo passo",
      "apply": "Capito: applica",
      "step": {
        "direct": "In questo calcolo manca un solo numero: {eq} → il {v}."
      }
    },
    "achievements": {
      "perfectWin": {
        "desc": "Risolvi un puzzle senza nemmeno un errore."
      },
      "perfectTen": {
        "desc": "Vinci 10 puzzle senza errori."
      },
      "bigPerfect": {
        "desc": "Vinci un puzzle Numeri grandi senza errori."
      }
    },
    "share": {
      "coopInvite": "Gioca a Coop Math Cross con me in modalità co-op! Codice: {code} — {url}"
    },
    "howto": {
      "rule1": "Metti i numeri della <b>riserva</b> in basso nelle caselle vuote: <b>trascinali</b> oppure <b>tocca</b> un numero e poi la casella.",
      "rule2": "Ogni <b>calcolo</b> orizzontale e verticale deve tornare, p. es. <b>7 × 3 = 21</b>.",
      "rule3": "Solo <b>numeri interi</b>, mai virgole, e un <b>risultato</b> non è mai negativo. I <b>passaggi intermedi</b> possono esserlo: <b>1 − 4 + 7 = 4</b> va bene.",
      "rule4": "Due tessere posate si <b>scambiano</b>: tocca la prima (resta selezionata), poi la seconda. Trascinare funziona allo stesso modo.",
      "ruleTapBack": "Toccare <b>tre volte</b> una tessera posata la rimanda nella riserva.",
      "ruleMark": "<b>Tieni premuta</b> una casella per evidenziarla. È solo un appunto per te: non significa nulla per il puzzle e nessun altro lo vede — decidi tu a cosa serve. Il colore si sceglie nelle impostazioni. Per marcare più caselle di seguito attiva in alto la <b>modalità marcatura</b> (pulsante pennello): lì basta <b>un tocco</b> per casella, ma finché è attiva i numeri non si possono toccare.",
      "rule5": "La riserva contiene <b>esattamente</b> i numeri mancanti: se ne avanza qualcuno, qualcosa è fuori posto.",
      "rule6": "Ogni schema ha una soluzione unica, <b>senza tirare a indovinare</b>. C’è <b>errore</b> solo quando una tessera completa un calcolo che non torna: costa una vita. Mettere una tessera in una casella dove alla fine va un <b>altro</b> numero <b>non</b> è quindi un errore: finché il calcolo ha ancora un vuoto, non succede nulla. Puoi provare con calma.",
      "rule7Coop": "In co-op condividete le <b>vite</b>: una vita persa viene barrata nel colore del giocatore che ha sbagliato.",
      "rule9": "Un <b>record</b> conta solo per una partita <b>senza errori</b>: dopo un errore te lo segnaliamo durante e a fine partita."
    },
    "a11y": {
      "cellLabel": "Riga {row}, colonna {col}, {status}",
      "cellGiven": "dato",
      "cellEmpty": "vuoto",
      "cellFilled": "contiene {value}"
    }
  },
  "ja": {
    "diffShift": {
      "toast": "各難易度がひとつ下にずれ、頂点には新しくもっと手強い R.I.P. が加わりました。記録もいっしょに移動しています。"
    },
    "game": {
      "markMode": "マークモード",
      "markTools": "マーク",
      "clearMarks": "マークをすべて消す",
      "clearMarksTitle": "マークをすべて消しますか？",
      "clearMarksMsg": "{n} 個のマークを削除します。元に戻せません。"
    },
    "soloInvite": {
      "shareText": "一緒にMath Crossで遊ぼう！進行中のゲームに参加してね – ルームコード: {code}"
    },
    "settings": {
      "divStyle": "割り算の記号",
      "divStyleAsk": "盤面の「割る」をどう表示しますか？",
      "divStyleHint": "表示だけの設定です。問題そのものは変わりません。いつでもここで変更できます。",
      "div_obelus": "除算記号",
      "div_colon": "コロン",
      "div_slash": "スラッシュ",
      "divExample": "例: 12 {sym} 3 = 4",
      "sfxChat": "チャット",
      "dragScale": "ドラッグの移動倍率",
      "dragScaleHint": "つかんだタイルが指の動きより大きく動きます。3倍なら小さな動きで3倍の距離を移動できるので、画面全体を指でなぞらなくても盤面の上まで届きます。置かれるのは常にタイルが表示されている位置です。",
      "dragScaleOff": "1倍（オフ）",
      "dragScaleOn": "{f}倍",
      "colorBlindModeHint": "ゲーム全体（正解/不正解、ライフ、Coopカラーなど）の緑/赤を、赤緑・青黄色覚異常でも区別しやすい色に置き換えます。",
      "markColor": "目印の色",
      "markColorHint": "自分用の目印の色です。マスを長押しすると目立たせられます。目印はパズルの進行には関係なく、使い道は自由。ほかの人には見えません。"
    },
    "prestige": {
      "master": {
        "desc": "The ultimate badge — unlocked when ALL 12 badges reach Legendary. Proof that you have mastered Math Cross."
      }
    },
    "training": {
      "title": "次のステップ",
      "apply": "わかった – 実行",
      "step": {
        "direct": "この式で足りない数は 1 つだけ：{eq} → {v}。"
      }
    },
    "achievements": {
      "perfectWin": {
        "desc": "ミスなしでパズルを解く。"
      },
      "perfectTen": {
        "desc": "ミスなしで10回勝利する。"
      },
      "bigPerfect": {
        "desc": "「大きな数字」の問題をミスなしで勝利する。"
      }
    },
    "share": {
      "coopInvite": "Coop Math Crossを一緒にCoopモードで遊ぼう！コード: {code} — {url}"
    },
    "howto": {
      "rule1": "下の<b>手持ち</b>から数字を空きマスに置きます。<b>ドラッグ</b>するか、数字を<b>タップ</b>してからマスをタップします。",
      "rule2": "縦と横の<b>すべての式</b>が成り立つ必要があります（例：<b>7 × 3 = 21</b>）。",
      "rule3": "使うのは<b>整数だけ</b>で小数はなく、<b>答え</b>がマイナスになることもありません。ただし<b>途中の計算</b>はマイナスでも構いません: <b>1 − 4 + 7 = 4</b> は正しい式です。",
      "rule4": "置いた 2 つのタイルは<b>入れ替え</b>られます。片方をタップして（選ばれたままになります）、もう片方をタップするだけ。ドラッグでも同じです。",
      "ruleTapBack": "置いたタイルを<b>3 回タップ</b>すると手持ちに戻ります。",
      "ruleMark": "マスを<b>長押し</b>すると色が付きます。これはあなた専用のメモで、パズルには影響せず、ほかの人にも見えません。使い道は自由です。色は設定で選べます。 続けて複数のマスに印を付けたいときは、上の<b>マークモード</b>（ブラシのボタン）をオンにします。マスごとに<b>1 回タップ</b>するだけで済みますが、その間は数字に触れられません。",
      "rule5": "手持ちには足りない数が<b>ちょうど</b>あります。余ったら、どこかが違います。",
      "rule6": "どの問題も<b>推測なし</b>で一意に解けます。 <b>ミス</b>になるのは、式を完成させたのに答えが合わないときだけ。ライフが 1 つ減ります。 つまり、最終的に<b>別の</b>数が入るマスに置いても<b>ミスにはなりません</b>。式に空きが残っているあいだは何も起きないので、安心して試せます。",
      "rule7Coop": "協力プレイでは<b>ライフ</b>を共有します。失ったライフは、ミスをしたプレイヤーの色で消されます。",
      "rule9": "<b>ベストタイム</b>は<b>ミスのない</b>プレイでのみ記録されます。ミスをするとゲーム中と終了時に表示されます。"
    },
    "a11y": {
      "cellLabel": "{row} 行 {col} 列、{status}",
      "cellGiven": "初期値",
      "cellEmpty": "空",
      "cellFilled": "{value} が入っています"
    }
  },
  "ko": {
    "diffShift": {
      "toast": "모든 난이도가 한 단계씩 내려가고 맨 위에 더 어려운 새 R.I.P.가 추가되었습니다. 기록도 함께 옮겨졌습니다."
    },
    "game": {
      "markMode": "표시 모드",
      "markTools": "표시",
      "clearMarks": "표시 모두 지우기",
      "clearMarksTitle": "표시를 모두 지울까요?",
      "clearMarksMsg": "표시 {n}개가 제거됩니다. 되돌릴 수 없습니다."
    },
    "soloInvite": {
      "shareText": "나와 함께 Math Cross를 플레이해요! 진행 중인 게임에 참여하세요 – 방 코드: {code}"
    },
    "settings": {
      "divStyle": "나누기 기호",
      "divStyleAsk": "보드에서 ‘나누기’를 어떻게 표시할까요?",
      "divStyleHint": "표시만 바뀝니다. 퍼즐 자체는 그대로이며 언제든 여기서 바꿀 수 있습니다.",
      "div_obelus": "오벨루스",
      "div_colon": "콜론",
      "div_slash": "슬래시",
      "divExample": "예: 12 {sym} 3 = 4",
      "sfxChat": "채팅 메시지",
      "dragScale": "드래그 이동 배율",
      "dragScaleHint": "드래그하는 타일이 손가락 움직임보다 크게 움직입니다. 3배로 두면 짧게 움직여도 세 배 멀리 이동하므로 화면 전체를 훑지 않고도 판 위쪽에 닿습니다. 타일이 보이는 자리에 놓입니다.",
      "dragScaleOff": "1배(끄기)",
      "dragScaleOn": "{f}배",
      "colorBlindModeHint": "게임 전체(정답/오답, 생명, 협동 색상 등)의 초록/빨강을 적록/청황 색각 이상에서도 구별하기 쉬운 색으로 바꿉니다.",
      "markColor": "표시 색상",
      "markColorHint": "나만의 메모 표시 색상입니다. 칸을 길게 누르면 강조됩니다. 표시는 퍼즐에 아무 영향이 없으며 용도는 자유롭게 정하면 됩니다. 나만 볼 수 있습니다."
    },
    "prestige": {
      "master": {
        "desc": "The ultimate badge — unlocked when ALL 12 badges reach Legendary. Proof that you have mastered Math Cross."
      }
    },
    "training": {
      "title": "다음 단계",
      "apply": "이해했어요 – 적용",
      "step": {
        "direct": "이 식에는 숫자가 하나만 빠져 있습니다: {eq} → {v}."
      }
    },
    "achievements": {
      "perfectWin": {
        "desc": "실수 없이 퍼즐을 풀었습니다."
      },
      "perfectTen": {
        "desc": "실수 없이 퍼즐 10개를 승리했습니다."
      },
      "bigPerfect": {
        "desc": "실수 없이 큰 숫자 퍼즐을 이깁니다."
      }
    },
    "share": {
      "coopInvite": "Coop Math Cross을 협동 모드로 함께 플레이해요! 코드: {code} — {url}"
    },
    "howto": {
      "rule1": "아래 <b>보유 칸</b>의 숫자를 빈 칸에 놓습니다. <b>끌어다 놓거나</b>, 숫자를 <b>탭한 뒤</b> 칸을 탭하면 됩니다.",
      "rule2": "가로와 세로의 <b>모든 식</b>이 맞아야 합니다. 예: <b>7 × 3 = 21</b>.",
      "rule3": "<b>정수</b>만 사용하고 소수는 없으며 <b>답</b>이 음수가 되는 일도 없습니다. 다만 <b>중간 계산</b>은 음수여도 됩니다: <b>1 − 4 + 7 = 4</b> 는 올바른 식입니다.",
      "rule4": "놓인 두 타일은 <b>자리를 바꿀</b> 수 있습니다. 하나를 탭하면 선택된 상태로 남고, 다른 하나를 탭하면 교환됩니다. 끌어도 똑같습니다.",
      "ruleTapBack": "놓인 타일을 <b>세 번</b> 탭하면 보유 칸으로 돌아갑니다.",
      "ruleMark": "칸을 <b>길게 누르면</b> 색으로 표시됩니다. 나만을 위한 메모라서 퍼즐에는 아무 영향이 없고 다른 사람에게도 보이지 않습니다. 용도는 자유이며 색은 설정에서 고릅니다. 여러 칸을 연달아 표시하려면 위쪽의 <b>표시 모드</b>(붓 버튼)를 켜세요. 칸마다 <b>한 번만 탭</b>하면 되고, 켜져 있는 동안에는 숫자를 만질 수 없습니다.",
      "rule5": "보유 칸에는 빠진 숫자가 <b>정확히</b> 들어 있습니다. 남으면 어딘가 잘못 놓인 것입니다.",
      "rule6": "모든 퍼즐은 <b>추측 없이</b> 유일하게 풀립니다. 식을 완성했는데 맞지 않을 때만 <b>실수</b>이며, 생명이 하나 줄어듭니다. 따라서 최종적으로 <b>다른</b> 숫자가 들어갈 칸에 놓아도 <b>실수가 아닙니다</b>. 식에 빈칸이 남아 있는 동안에는 아무 일도 일어나지 않으니 마음 놓고 시도해 보세요.",
      "rule7Coop": "협동에서는 <b>생명</b>을 함께 씁니다. 잃은 생명은 실수한 플레이어의 색으로 그어집니다.",
      "rule9": "<b>최고 기록</b>은 <b>실수 없는</b> 게임에서만 인정됩니다. 실수하면 게임 중과 종료 시에 알려 줍니다."
    },
    "a11y": {
      "cellLabel": "{row}행 {col}열, {status}",
      "cellGiven": "주어짐",
      "cellEmpty": "비어 있음",
      "cellFilled": "{value} 있음"
    }
  },
  "tr": {
    "diffShift": {
      "toast": "Her zorluk bir basamak aşağı kaydı ve en üstte yeni, daha zorlu bir R.I.P. bekliyor — istatistiklerin de onlarla birlikte taşındı."
    },
    "game": {
      "markMode": "İşaretleme modu",
      "markTools": "İşaretleme",
      "clearMarks": "Tüm işaretleri sil",
      "clearMarksTitle": "Tüm işaretler silinsin mi?",
      "clearMarksMsg": "{n} işaret kaldırılacak. Bu geri alınamaz."
    },
    "soloInvite": {
      "shareText": "Benimle Math Cross oyna! Devam eden oyunuma katıl – oda kodu: {code}"
    },
    "settings": {
      "divStyle": "Bölme işareti",
      "divStyleAsk": "Tahtada “bölü” nasıl görünsün?",
      "divStyleHint": "Yalnızca görünüm — bulmacalar aynı kalır. Buradan istediğin zaman değiştirebilirsin.",
      "div_obelus": "Obelüs",
      "div_colon": "İki nokta",
      "div_slash": "Eğik çizgi",
      "divExample": "ör. 12 {sym} 3 = 4",
      "sfxChat": "Sohbet mesajı",
      "dragScale": "Sürükleme menzili",
      "dragScaleHint": "Sürüklediğin taş parmağını büyütülmüş şekilde izler: 3x ile kısa bir hareket onu üç kat uzağa taşır, böylece ekranın tamamını taramadan tahtanın üst kenarına ulaşırsın. Her zaman göründüğü yere bırakılır.",
      "dragScaleOff": "1x (kapalı)",
      "dragScaleOn": "{f}x",
      "colorBlindModeHint": "Oyunun her yerindeki (doğru/yanlış, canlar, coop renkleri, ...) yeşil/kırmızıyı, kırmızı-yeşil/mavi-sarı renk görme bozukluğu için daha kolay ayırt edilen tonlarla değiştirir.",
      "markColor": "İşaret rengi",
      "markColorHint": "Kendi notların için işaret rengi: bir kareye basılı tutarsan vurgulanır. İşaretin bulmaca için hiçbir anlamı yok — ne için kullanacağına sen karar verirsin. Yalnızca sen görürsün."
    },
    "prestige": {
      "master": {
        "desc": "The ultimate badge — unlocked when ALL 12 badges reach Legendary. Proof that you have mastered Math Cross."
      }
    },
    "training": {
      "title": "Sonraki adım",
      "apply": "Anladım – uygula",
      "step": {
        "direct": "Bu işlemde yalnızca bir sayı eksik: {eq} → {v}."
      }
    },
    "achievements": {
      "perfectWin": {
        "desc": "Tek bir hata yapmadan bir bulmaca çöz."
      },
      "perfectTen": {
        "desc": "Hatasız 10 bulmaca kazan."
      },
      "bigPerfect": {
        "desc": "Hatasız bir Büyük Sayılar bulmacası kazan."
      }
    },
    "share": {
      "coopInvite": "Coop Math Cross'ı benimle coop modunda oyna! Kod: {code} — {url}"
    },
    "howto": {
      "rule1": "Aşağıdaki <b>stoktaki</b> sayıları boş karelere yerleştir: <b>sürükle</b> ya da bir sayıya <b>dokun</b> ve sonra kareye dokun.",
      "rule2": "Yatay ve dikey <b>her işlem</b> tutmalı, örn. <b>7 × 3 = 21</b>.",
      "rule3": "Yalnızca <b>tam sayılar</b>, virgül yok ve bir <b>sonuç</b> asla eksi olmaz. <b>Ara adımlar</b> ise olabilir: <b>1 − 4 + 7 = 4</b> geçerlidir.",
      "rule4": "Yerleştirilmiş iki taş <b>yer değiştirir</b>: birine dokun (seçili kalır), sonra diğerine dokun. Sürüklemek de aynı işi görür.",
      "ruleTapBack": "Yerleştirilmiş bir taşa <b>üç kez</b> dokunmak onu stoka geri gönderir.",
      "ruleMark": "Bir kareye <b>basılı tutarsan</b> renkle işaretlenir. Bu yalnızca senin notun: bulmaca için bir anlamı yok, başkası göremez — ne için kullanacağına sen karar verirsin. Rengi ayarlardan seçersin. Arka arkaya birkaç kareyi işaretlemek için yukarıdaki <b>işaretleme modunu</b> aç (fırça düğmesi): orada kare başına <b>tek dokunuş</b> yeter, ama açıkken sayılara dokunulamaz.",
      "rule5": "Stokta eksik sayılar <b>tam olarak</b> vardır: artan olursa bir şey yanlış yerdedir.",
      "rule6": "Her bulmaca <b>tahmin gerektirmeden</b> tek çözümlüdür. Sadece bir taş bir işlemi tamamlayıp işlem tutmuyorsa <b>hata</b> olur; bu bir can götürür. Yani sonunda <b>başka</b> bir sayının geleceği bir kareye taş koymak <b>hata değildir</b>: işlemde hâlâ boşluk varsa hiçbir şey olmaz. Rahatça deneyebilirsin.",
      "rule7Coop": "Coop'ta <b>canları</b> paylaşırsınız — kaybedilen bir can, hatayı yapan oyuncunun renginde üstü çizilerek gösterilir.",
      "rule9": "Bir <b>en iyi süre</b> yalnızca <b>hatasız</b> bir oyunda geçerlidir — hata yaptığında oyun sırasında ve sonunda bilgilendirilirsin."
    },
    "a11y": {
      "cellLabel": "Satır {row}, sütun {col}, {status}",
      "cellGiven": "verili",
      "cellEmpty": "boş",
      "cellFilled": "{value} var"
    }
  },
  "ru": {
    "diffShift": {
      "toast": "Каждая сложность сдвинулась на ступень вниз, а наверху появился новый, более трудный R.I.P. — статистика переехала вместе с ними."
    },
    "game": {
      "markMode": "Режим пометок",
      "markTools": "Пометки",
      "clearMarks": "Удалить все пометки",
      "clearMarksTitle": "Удалить все пометки?",
      "clearMarksMsg": "Будет удалено пометок: {n}. Отменить это нельзя."
    },
    "soloInvite": {
      "shareText": "Сыграй со мной в Math Cross! Присоединяйся к моей текущей игре – код комнаты: {code}"
    },
    "settings": {
      "divStyle": "Знак деления",
      "divStyleAsk": "Как должно выглядеть «разделить на» на поле?",
      "divStyleHint": "Только отображение — сами головоломки не меняются. Изменить можно здесь в любой момент.",
      "div_obelus": "Обелюс",
      "div_colon": "Двоеточие",
      "div_slash": "Косая черта",
      "divExample": "напр. 12 {sym} 3 = 4",
      "sfxChat": "Сообщение в чате",
      "dragScale": "Дальность перетаскивания",
      "dragScaleHint": "Перетаскиваемая плитка движется быстрее пальца: при 3x короткое движение уводит её втрое дальше, поэтому до верха поля можно дотянуться без движения через весь экран. Кладётся туда, где плитка видна.",
      "dragScaleOff": "1x (выкл.)",
      "dragScaleOn": "{f}x",
      "colorBlindModeHint": "Заменяет зелёный/красный во всей игре (правильно/неправильно, жизни, цвета в коопе, ...) на более различимые оттенки для нарушений цветовосприятия красно-зелёного/сине-жёлтого типа.",
      "markColor": "Цвет пометки",
      "markColorHint": "Цвет ваших личных пометок: удерживайте клетку, чтобы выделить её. На головоломку пометка никак не влияет — решайте сами, для чего она. Видите её только вы."
    },
    "prestige": {
      "master": {
        "desc": "The ultimate badge — unlocked when ALL 12 badges reach Legendary. Proof that you have mastered Math Cross."
      }
    },
    "training": {
      "title": "Следующий шаг",
      "apply": "Понятно — выполнить",
      "step": {
        "direct": "В этом выражении не хватает одного числа: {eq} → {v}."
      }
    },
    "achievements": {
      "perfectWin": {
        "desc": "Реши головоломку без единой ошибки."
      },
      "perfectTen": {
        "desc": "Победи в 10 головоломках без ошибок."
      },
      "bigPerfect": {
        "desc": "Выиграйте головоломку «Большие числа» без ошибок."
      }
    },
    "share": {
      "coopInvite": "Сыграй со мной в Coop Math Cross в кооперативном режиме! Код: {code} — {url}"
    },
    "howto": {
      "rule1": "Ставьте числа из <b>запаса</b> внизу в пустые клетки: <b>перетащите</b> их или <b>нажмите</b> на число, а затем на клетку.",
      "rule2": "Каждое горизонтальное и вертикальное <b>выражение</b> должно сходиться, например <b>7 × 3 = 21</b>.",
      "rule3": "Только <b>целые числа</b>, без дробей, и <b>результат</b> никогда не бывает отрицательным. А вот <b>промежуточные шаги</b> — вполне: <b>1 − 4 + 7 = 4</b> допустимо.",
      "rule4": "Две поставленные фишки <b>меняются местами</b>: нажмите на одну (она останется выбранной), затем на другую. Перетаскивание работает так же.",
      "ruleTapBack": "Тройное <b>нажатие</b> на поставленную фишку возвращает её в запас.",
      "ruleMark": "<b>Удерживайте</b> клетку, чтобы выделить её цветом. Это лишь заметка для вас: на головоломку она не влияет и никто другой её не видит — для чего она, решаете вы сами. Цвет выбирается в настройках. Чтобы пометить несколько клеток подряд, включите вверху <b>режим пометок</b> (кнопка с кистью): там достаточно <b>одного касания</b> на клетку, но числа при этом трогать нельзя.",
      "rule5": "В запасе ровно <b>те числа</b>, которых не хватает: если что-то осталось, значит, где-то ошибка.",
      "rule6": "Каждая головоломка решается однозначно и <b>без угадывания</b>. <b>Ошибка</b> — только когда фишка достраивает выражение, которое не сходится; это стоит жизни. Поэтому положить фишку туда, где в итоге стоит <b>другое</b> число, — <b>не</b> ошибка: пока в выражении остаётся пропуск, ничего не происходит. Можно спокойно пробовать.",
      "rule7Coop": "В кооперативе вы делите <b>жизни</b> — потерянная жизнь зачёркивается цветом игрока, который ошибся.",
      "rule9": "<b>Лучшее время</b> засчитывается только за игру <b>без ошибок</b> — после ошибки об этом сообщается во время игры и в конце."
    },
    "a11y": {
      "cellLabel": "Строка {row}, столбец {col}, {status}",
      "cellGiven": "дано",
      "cellEmpty": "пусто",
      "cellFilled": "стоит {value}"
    }
  }
};
