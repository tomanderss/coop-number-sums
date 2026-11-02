// games/numberlink/i18n.js — die TEXTE, die „Number Link" anders braucht als
// die gemeinsame Schale: eigene Schlüssel (nl.*) und abweichende Fassungen
// (Anleitung, Einladungstext, Meister-Abzeichen). Ebene ÜBER den gemeinsamen
// Texten, solange Number Link aktiv ist (s. setGameMessages). Jede Sprache trägt
// dieselben Schlüssel.

export default {
  de: {
    nl: { boardLabel: "Spielfeld: gleiche Zahlen verbinden", train: { title: "Nächster Schritt", body: "Die Linie der {n} kann nur genau so verlaufen – jeder andere Weg würde eine Zelle abschneiden, eine andere Linie blockieren oder eine Zelle unbedeckt lassen." } },
    howto: {
      rule1: "Jede Zahl steht <b>zweimal</b> auf dem Brett, jede in ihrer eigenen Farbe. <b>Verbinde gleiche Zahlen</b> mit einer Linie.",
      rule2: "Auf einer Zahl aufsetzen und ziehen – die Linie läuft <b>waagerecht oder senkrecht</b> von Zelle zu Zelle.",
      rule3: "Linien <b>kreuzen sich nie</b> und teilen keine Zelle. Am Ende ist <b>jede Zelle</b> von einer Linie bedeckt.",
      rule4: "Ziehst du über eine fremde Linie, wird sie dort <b>abgeschnitten</b> – zieh zurück, und sie ist wieder da. Fremde Zahlen sind gesperrt.",
      rule5: "Zum Korrigieren <b>zurückziehen</b> oder auf der Linie aufsetzen und neu weiterziehen. Ist das Brett gezoomt, verschiebst du es mit <b>zwei Fingern</b>.",
      rule6: "Fehler gibt es keine – es zählt nur das fertige Brett. Jedes Rätsel hat genau eine Lösung und ist <b>ohne Raten</b> lösbar.",
    },
    soloInvite: { shareText: "Spiel mit mir Number Link! Tritt meinem laufenden Spiel bei – Raumcode: {code}" },
    prestige: { master: { desc: "Das ultimative Abzeichen — freigeschaltet, wenn ALLE 12 Abzeichen auf Legendär stehen. Der Beweis, dass du Number Link gemeistert hast." } },
  },
  en: {
    nl: { boardLabel: "Board: connect equal numbers", train: { title: "Next step", body: "The line of the {n} can only run exactly like this – any other way would cut off a cell, block another line or leave a cell uncovered." } },
    howto: {
      rule1: "Every number appears <b>twice</b> on the board, each in its own colour. <b>Connect equal numbers</b> with a line.",
      rule2: "Touch a number and drag – the line runs <b>horizontally or vertically</b> from cell to cell.",
      rule3: "Lines <b>never cross</b> and never share a cell. In the end <b>every cell</b> is covered by a line.",
      rule4: "Dragging over another line <b>cuts</b> it there – drag back and it returns. Other numbers are blocked.",
      rule5: "To correct, <b>drag back</b> or touch the line and continue from there. When the board is zoomed, move it with <b>two fingers</b>.",
      rule6: "There are no mistakes – only the finished board counts. Every puzzle has exactly one solution, reachable <b>without guessing</b>.",
    },
    soloInvite: { shareText: "Play Number Link with me! Join my running game – room code: {code}" },
    prestige: { master: { desc: "The ultimate badge — unlocked when ALL 12 badges are Legendary. Proof that you have mastered Number Link." } },
  },
  es: {
    nl: { boardLabel: "Tablero: une números iguales", train: { title: "Siguiente paso", body: "La línea del {n} solo puede ir exactamente así: cualquier otro camino aislaría una celda, bloquearía otra línea o dejaría una celda sin cubrir." } },
    howto: {
      rule1: "Cada número aparece <b>dos veces</b> en el tablero, cada uno con su propio color. <b>Une los números iguales</b> con una línea.",
      rule2: "Toca un número y arrastra: la línea va <b>en horizontal o vertical</b> de celda en celda.",
      rule3: "Las líneas <b>nunca se cruzan</b> ni comparten celdas. Al final <b>cada celda</b> queda cubierta por una línea.",
      rule4: "Si arrastras sobre otra línea, se <b>corta</b> ahí; vuelve atrás y reaparece. Los números ajenos están bloqueados.",
      rule5: "Para corregir, <b>arrastra hacia atrás</b> o toca la línea y sigue desde ahí. Con el tablero ampliado, muévelo con <b>dos dedos</b>.",
      rule6: "No hay errores: solo cuenta el tablero terminado. Cada puzle tiene una única solución <b>sin adivinar</b>.",
    },
    soloInvite: { shareText: "¡Juega Number Link conmigo! Únete a mi partida – código de sala: {code}" },
    prestige: { master: { desc: "La insignia definitiva: se desbloquea cuando TODAS las 12 insignias son legendarias. La prueba de que dominas Number Link." } },
  },
  fr: {
    nl: { boardLabel: "Grille : relie les nombres identiques", train: { title: "Étape suivante", body: "La ligne du {n} ne peut passer qu’exactement ainsi – tout autre chemin isolerait une case, bloquerait une autre ligne ou laisserait une case vide." } },
    howto: {
      rule1: "Chaque nombre apparaît <b>deux fois</b> sur la grille, chacun dans sa couleur. <b>Relie les nombres identiques</b> par une ligne.",
      rule2: "Pose le doigt sur un nombre et glisse – la ligne va <b>horizontalement ou verticalement</b> de case en case.",
      rule3: "Les lignes <b>ne se croisent jamais</b> et ne partagent aucune case. À la fin, <b>chaque case</b> est couverte.",
      rule4: "Glisser sur une autre ligne la <b>coupe</b> à cet endroit – reviens en arrière et elle réapparaît. Les autres nombres sont bloqués.",
      rule5: "Pour corriger, <b>reviens en arrière</b> ou touche la ligne et continue de là. Si la grille est zoomée, déplace-la avec <b>deux doigts</b>.",
      rule6: "Il n’y a pas d’erreurs – seule la grille terminée compte. Chaque grille a une seule solution, <b>sans deviner</b>.",
    },
    soloInvite: { shareText: "Joue à Number Link avec moi ! Rejoins ma partie – code du salon : {code}" },
    prestige: { master: { desc: "Le badge ultime — débloqué quand LES 12 badges sont Légendaires. La preuve que tu maîtrises Number Link." } },
  },
  'pt-BR': {
    nl: { boardLabel: "Tabuleiro: ligue números iguais", train: { title: "Próximo passo", body: "A linha do {n} só pode seguir exatamente assim – qualquer outro caminho isolaria uma célula, bloquearia outra linha ou deixaria uma célula descoberta." } },
    howto: {
      rule1: "Cada número aparece <b>duas vezes</b> no tabuleiro, cada um com sua cor. <b>Ligue os números iguais</b> com uma linha.",
      rule2: "Toque num número e arraste – a linha segue <b>na horizontal ou vertical</b> de célula em célula.",
      rule3: "As linhas <b>nunca se cruzam</b> nem dividem células. No fim, <b>toda célula</b> fica coberta por uma linha.",
      rule4: "Arrastar sobre outra linha a <b>corta</b> ali – volte e ela reaparece. Números alheios ficam bloqueados.",
      rule5: "Para corrigir, <b>arraste de volta</b> ou toque na linha e continue dali. Com o tabuleiro ampliado, mova-o com <b>dois dedos</b>.",
      rule6: "Não há erros – só conta o tabuleiro completo. Cada quebra-cabeça tem uma única solução, <b>sem chutar</b>.",
    },
    soloInvite: { shareText: "Jogue Number Link comigo! Entre no meu jogo – código da sala: {code}" },
    prestige: { master: { desc: "O emblema definitivo — desbloqueado quando TODOS os 12 emblemas estão no Lendário. A prova de que você domina Number Link." } },
  },
  it: {
    nl: { boardLabel: "Griglia: collega i numeri uguali", train: { title: "Prossimo passo", body: "La linea del {n} può passare solo esattamente così – ogni altro percorso isolerebbe una cella, bloccherebbe un'altra linea o lascerebbe una cella scoperta." } },
    howto: {
      rule1: "Ogni numero compare <b>due volte</b> sulla griglia, ognuno nel suo colore. <b>Collega i numeri uguali</b> con una linea.",
      rule2: "Tocca un numero e trascina – la linea va <b>in orizzontale o verticale</b> di cella in cella.",
      rule3: "Le linee <b>non si incrociano mai</b> e non condividono celle. Alla fine <b>ogni cella</b> è coperta.",
      rule4: "Trascinando su un'altra linea la <b>tagli</b> lì – torna indietro e riappare. I numeri altrui sono bloccati.",
      rule5: "Per correggere, <b>torna indietro</b> o tocca la linea e prosegui da lì. Con la griglia ingrandita, spostala con <b>due dita</b>.",
      rule6: "Non ci sono errori – conta solo la griglia finita. Ogni puzzle ha una sola soluzione, <b>senza tirare a indovinare</b>.",
    },
    soloInvite: { shareText: "Gioca a Number Link con me! Entra nella mia partita – codice stanza: {code}" },
    prestige: { master: { desc: "Il distintivo definitivo — si sblocca quando TUTTI i 12 distintivi sono Leggendari. La prova che padroneggi Number Link." } },
  },
  ja: {
    nl: { boardLabel: "盤面：同じ数字をつなぐ", train: { title: "次の一手", body: "{n} の線はこの通りにしか引けません。ほかの道ではマスが孤立するか、別の線をふさぐか、マスが埋まらなくなります。" } },
    howto: {
      rule1: "各数字は盤面に<b>2つずつ</b>あり、それぞれ自分の色を持っています。<b>同じ数字どうし</b>を線でつなごう。",
      rule2: "数字に触れてドラッグ。線はマスからマスへ<b>縦か横</b>に進みます。",
      rule3: "線は<b>交差せず</b>、マスを共有しません。最後には<b>すべてのマス</b>が線で埋まります。",
      rule4: "ほかの線の上をなぞるとそこで<b>切れます</b>。戻ればまた現れます。ほかの数字は通れません。",
      rule5: "直すときは<b>引き戻す</b>か、線に触れてそこから続けます。拡大中は<b>2本指</b>で盤面を動かせます。",
      rule6: "ミスはありません。完成した盤面だけが数えられます。どの問題も答えはひとつで、<b>当て推量なし</b>で解けます。",
    },
    soloInvite: { shareText: "一緒に Number Link をやろう！進行中のゲームに参加してね – ルームコード: {code}" },
    prestige: { master: { desc: "究極のバッジ — 12個すべてのバッジがレジェンドになると解放。Number Link を極めた証。" } },
  },
  ko: {
    nl: { boardLabel: "보드: 같은 숫자 잇기", train: { title: "다음 단계", body: "{n}의 선은 정확히 이렇게만 갈 수 있어요. 다른 길은 칸을 고립시키거나, 다른 선을 막거나, 칸을 비워 두게 됩니다." } },
    howto: {
      rule1: "각 숫자는 보드에 <b>두 번</b> 나오며, 저마다 고유한 색이 있어요. <b>같은 숫자끼리</b> 선으로 이으세요.",
      rule2: "숫자를 누르고 드래그하면 선이 칸에서 칸으로 <b>가로나 세로</b>로 이어집니다.",
      rule3: "선은 <b>절대 교차하지 않고</b> 칸을 나누지 않아요. 마지막엔 <b>모든 칸</b>이 선으로 덮입니다.",
      rule4: "다른 선 위로 드래그하면 그곳에서 <b>잘려요</b>. 되돌아가면 다시 나타납니다. 다른 숫자는 막혀 있어요.",
      rule5: "고칠 때는 <b>되돌려 끌거나</b> 선을 눌러 거기서 이어 가세요. 확대한 보드는 <b>두 손가락</b>으로 움직입니다.",
      rule6: "실수는 없어요. 완성된 보드만 중요합니다. 모든 퍼즐은 답이 하나이며 <b>추측 없이</b> 풀 수 있어요.",
    },
    soloInvite: { shareText: "나랑 Number Link 하자! 진행 중인 게임에 참여해 – 방 코드: {code}" },
    prestige: { master: { desc: "궁극의 배지 — 12개 배지가 모두 레전더리가 되면 해제됩니다. Number Link를 마스터했다는 증거." } },
  },
  tr: {
    nl: { boardLabel: "Tahta: aynı sayıları birleştir", train: { title: "Sonraki adım", body: "{n} çizgisi yalnızca tam böyle ilerleyebilir – başka her yol bir hücreyi yalnız bırakır, başka bir çizgiyi tıkar ya da bir hücreyi boş bırakır." } },
    howto: {
      rule1: "Her sayı tahtada <b>iki kez</b> bulunur, her biri kendi renginde. <b>Aynı sayıları</b> bir çizgiyle birleştir.",
      rule2: "Bir sayıya dokun ve sürükle – çizgi hücreden hücreye <b>yatay ya da dikey</b> ilerler.",
      rule3: "Çizgiler <b>asla kesişmez</b> ve hücre paylaşmaz. Sonunda <b>her hücre</b> bir çizgiyle kaplanır.",
      rule4: "Başka bir çizginin üzerinden geçersen orada <b>kesilir</b> – geri çek, yeniden görünür. Başka sayılar kapalıdır.",
      rule5: "Düzeltmek için <b>geri çek</b> ya da çizgiye dokunup oradan devam et. Tahta yakınlaştırılmışsa <b>iki parmakla</b> kaydır.",
      rule6: "Hata diye bir şey yok – yalnızca bitmiş tahta sayılır. Her bulmacanın tek çözümü vardır ve <b>tahmin etmeden</b> çözülür.",
    },
    soloInvite: { shareText: "Benimle Number Link oyna! Devam eden oyunuma katıl – oda kodu: {code}" },
    prestige: { master: { desc: "Nihai rozet — 12 rozetin TAMAMI Efsanevi olduğunda açılır. Number Link'te ustalaştığının kanıtı." } },
  },
  ru: {
    nl: { boardLabel: "Поле: соедините одинаковые числа", train: { title: "Следующий шаг", body: "Линия числа {n} может пройти только так – любой другой путь отрезал бы клетку, перекрыл бы другую линию или оставил клетку пустой." } },
    howto: {
      rule1: "Каждое число стоит на поле <b>дважды</b>, у каждого свой цвет. <b>Соедините одинаковые числа</b> линией.",
      rule2: "Коснитесь числа и ведите – линия идёт <b>по горизонтали или вертикали</b> от клетки к клетке.",
      rule3: "Линии <b>никогда не пересекаются</b> и не делят клетки. В конце <b>каждая клетка</b> покрыта линией.",
      rule4: "Проведёте по чужой линии – она там <b>обрежется</b>; вернитесь назад, и она восстановится. Чужие числа закрыты.",
      rule5: "Чтобы исправить, <b>ведите назад</b> или коснитесь линии и продолжите оттуда. Увеличенное поле двигайте <b>двумя пальцами</b>.",
      rule6: "Ошибок нет – считается только готовое поле. У каждой головоломки одно решение, <b>без угадывания</b>.",
    },
    soloInvite: { shareText: "Сыграй со мной в Number Link! Присоединяйся к игре – код комнаты: {code}" },
    prestige: { master: { desc: "Высший значок — открывается, когда ВСЕ 12 значков легендарные. Доказательство, что вы освоили Number Link." } },
  },
};
