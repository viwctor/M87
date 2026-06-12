# M87 - Controle de Faltas

M87 é um aplicativo web progressivo (PWA) para controle de frequência acadêmica do
curso de Administração da FEA-RP/USP (Faculdade de Economia, Administração e
Contabilidade de Ribeirão Preto, Universidade de São Paulo). Permite registrar faltas
por matéria e por aula, acompanhar o limite permitido em cada disciplina e visualizar
o histórico em um calendário. Funciona offline e pode ser instalado no celular
(Android e iOS) e no computador.

Acesso: https://viwctor.github.io/m87/

## Conteúdo padrão
O aplicativo já vem com o 3º e o 4º semestres do curso preenchidos, no turno da noite
(aulas às 19:00 e às 20:50). Todas as matérias, horários, datas e semestres podem ser
editados, adicionados ou removidos conforme a grade de cada usuário, pelo menu
Gerenciar. Também há suporte ao turno da manhã (aulas às 08:00 e às 10:00).

## Regras de falta
- Matéria de 4 créditos: limite de 8 faltas (dois encontros semanais).
- Matéria de 2 créditos: limite de 4 faltas (um encontro semanal).
- Cada aula faltada conta como uma falta. Faltar nas duas aulas do mesmo dia conta
  como duas.
- Feriados, dias sem aula e ausências do professor não são contabilizados no limite.

## Instalação
O aplicativo abre diretamente pelo endereço acima, mas pode ser instalado para
funcionar como um app, com ícone próprio, janela dedicada e uso offline.

- Android (Chrome): abra o endereço, toque no menu de três pontos e selecione
  "Instalar app".
- iPhone e iPad (Safari): abra o endereço no Safari, toque em Compartilhar e
  selecione "Adicionar à Tela de Início". No iOS, a instalação funciona apenas pelo
  Safari.
- Computador (Chrome ou Edge): abra o endereço e clique no ícone de instalar na barra
  de endereço, ou utilize o menu e selecione "Instalar M87".

## Como usar
- Painel: lista as matérias do semestre ativo com o número de faltas atuais e o
  limite de cada disciplina. A barra de progresso muda de cor conforme o uso, e um
  aviso é exibido na véspera do limite e quando o limite é atingido.
- Registrar ocorrência: toque no botão "+" ou em um dia do calendário. Selecione a
  data e, para cada aula, marque Presente, Falta ou Professor faltou. O dia inteiro
  também pode ser marcado como Feriado ou Sem aula.
- Calendário: cada dia é dividido em faixas, uma para cada aula. Faltar em apenas uma
  das aulas preenche metade da faixa; faltar nas duas preenche a faixa inteira.
- Gerenciar (menu no canto superior direito): adicionar, editar e remover matérias e
  semestres, definir horários e dias, escolher cor da matéria e alternar o semestre
  ativo.

## Backup dos dados
Os dados ficam armazenados apenas no aparelho em uso, no armazenamento local do
navegador. Limpar os dados do site ou do navegador remove as informações. Após cada
alteração, o aplicativo exibe um lembrete para realizar o backup.

- Exportar: menu Gerenciar, seção Backup, opção Exportar. Gera um arquivo `.json` com
  todos os dados.
- Importar: menu Gerenciar, seção Backup, opção Importar. Restaura os dados a partir
  de um arquivo `.json`, inclusive em outro aparelho.

Recomenda-se exportar um backup periodicamente para evitar perda de dados.
