# M87 — Controle de Faltas

Aplicativo web progressivo (PWA) para controle de frequência acadêmica, organizado
por semestres. Interface em tema escuro inspirada no buraco negro M87. Funciona
offline, pode ser instalado em celulares (Android e iOS) e em computadores, e
oferece sincronização opcional entre aparelhos.

## Sumário
- [Funcionalidades](#funcionalidades)
- [Regras de falta](#regras-de-falta)
- [Abrir no computador](#abrir-no-computador)
- [Publicar no GitHub Pages](#publicar-no-github-pages)
- [Instalar no celular](#instalar-no-celular)
- [Sincronizar entre aparelhos](#sincronizar-entre-aparelhos)
- [Personalizar o ícone](#personalizar-o-icone)
- [Execução local para testes](#execucao-local-para-testes)
- [Observações sobre os dados](#observacoes-sobre-os-dados)

## Funcionalidades
- **Painel:** um cartão por matéria com faltas atuais e máximas e uma barra de
  progresso que muda de cor conforme o uso. Exibe um aviso na véspera do limite
  (uma falta restante) e quando o limite é atingido.
- **Calendário:** cada dia é dividido em faixas — a superior representa a primeira
  aula e a inferior, a segunda. Faltar em apenas uma das aulas preenche metade da
  faixa; faltar nas duas preenche a faixa inteira.
- **Registro de ocorrências:** para cada aula é possível marcar Presente, Falta ou
  Professor faltou. O dia também pode ser marcado como Feriado ou Sem aula, sem
  contar no limite.
- **Turnos da manhã e da noite:** quatro horários disponíveis (08h, 10h, 19h e
  20h50). Cada matéria define em quais dias e horários ocorre.
- **Semestres:** o semestre 2026.1 já vem preenchido. É possível criar novos
  semestres (2026.2, 2027.1, e assim por diante) sem afetar o histórico anterior.
- **Backup e sincronização:** exportação e importação de um arquivo `.json`, além
  de sincronização opcional na nuvem.

## Regras de falta
- Matéria de **4 créditos**: limite de **8 faltas**.
- Matéria de **2 créditos**: limite de **4 faltas**.
- Cada aula faltada conta como uma falta; faltar nas duas aulas do dia conta como duas.

## Abrir no computador
- **Antes de publicar:** execute o arquivo `Abrir-M87.bat` (dois cliques). Ele inicia
  o servidor local e abre o navegador automaticamente. Para criar um atalho, clique
  com o botão direito no arquivo e selecione *Enviar para → Área de trabalho*.
- **Após publicar (recomendado):** abra o endereço do aplicativo no Chrome e use a
  opção de **instalar** na barra de endereço (ou menu → *Instalar M87*). O aplicativo
  passa a ter ícone próprio e janela dedicada, sem necessidade de servidor.

## Publicar no GitHub Pages
A publicação no GitHub Pages disponibiliza o aplicativo na internet, sem custo e sem
depender do seu computador.

1. Crie uma conta em [github.com](https://github.com) e um repositório novo, por
   exemplo `m87` (pode ser público).
2. Na página do repositório, selecione **Add file → Upload files** e envie todos os
   arquivos desta pasta, incluindo a subpasta `icons/`. Os arquivos `_serve.ps1` e
   `Abrir-M87.bat` são apenas para uso local e não precisam ser enviados. Conclua em
   **Commit changes**.
3. Acesse **Settings → Pages** e defina **Branch: `main`**, pasta **`/ (root)`**, e
   clique em **Save**.
4. Em aproximadamente um minuto, o aplicativo estará disponível em
   `https://SEU-USUARIO.github.io/m87/`. Esse é o endereço a compartilhar.

### Atualizações posteriores
O aplicativo armazena os arquivos em cache para funcionar offline. Ao enviar uma nova
versão, incremente o número de versão definido na constante `CACHE` do arquivo
`sw.js` (por exemplo, de `m87-v3` para `m87-v4`). Assim, o aplicativo aplica a
atualização na próxima abertura.

## Instalar no celular
- **Android (Chrome):** abra o endereço e selecione, no menu, **Instalar app**.
- **iOS (Safari):** abra o endereço, toque em **Compartilhar** e selecione
  **Adicionar à Tela de Início**. No iOS, a instalação funciona apenas pelo Safari.

## Sincronizar entre aparelhos
O aplicativo armazena os dados localmente em cada aparelho. Para que computador e
celular compartilhem os mesmos dados em tempo real, ative a sincronização via
Firebase (plano gratuito):

1. Acesse o [console do Firebase](https://console.firebase.google.com) e crie um
   projeto (o Google Analytics pode ser desativado).
2. No projeto, abra **Criação → Firestore Database** e selecione **Criar banco de
   dados**, em modo de teste ou de produção com a regra indicada adiante.
3. No início do projeto, clique no ícone de aplicativo da Web (`</>`), registre um
   aplicativo e copie o objeto `firebaseConfig` exibido.
4. No M87, acesse **Menu → Sincronização → Ativar**. Cole o objeto de configuração,
   defina um **código de sincronização** (um identificador particular, por exemplo
   `victor-m87-2026`) e selecione **Conectar**.
5. Repita o passo 4 nos demais aparelhos, usando a mesma configuração e o mesmo
   código. As alterações passam a ser refletidas entre os aparelhos em poucos segundos.

Regra de segurança recomendada (em Firestore → Regras). Qualquer pessoa que conheça o
código consegue ler e gravar os dados; portanto, utilize um código longo e mantenha-o
em sigilo:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /m87/{code} {
      allow read, write: if true;
    }
  }
}
```

Alternativa sem Firebase: utilize **Exportar** em um aparelho e **Importar** no outro
(Menu → Backup).

## Personalizar o ícone
Os ícones já acompanham o projeto. Para utilizar uma imagem própria do buraco negro:

1. Salve a imagem no computador, de preferência quadrada (por exemplo, 1024 × 1024).
2. Abra o arquivo `icons/make-icons.html` no navegador.
3. Selecione **Usar minha imagem** e escolha o arquivo.
4. Baixe os três arquivos gerados e salve-os na pasta `icons/`, substituindo os
   existentes, com os nomes exatos: `icon-192.png`, `icon-512.png` e
   `icon-512-maskable.png`. A versão *maskable* possui margem adicional (área de
   segurança recortada pelo Android), o que explica seu tamanho reduzido na
   pré-visualização.
5. A mesma imagem (`icons/icon-192.png`) é usada como ícone da aba do navegador e
   como logo no cabeçalho do aplicativo.
6. Caso o aplicativo já esteja publicado, envie os novos arquivos ao repositório e
   incremente a versão do cache em `sw.js`.

## Execução local para testes
Utilize o arquivo `Abrir-M87.bat` ou, alternativamente, o PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\_serve.ps1
```

O aplicativo ficará disponível em `http://localhost:8099`. Abrir o arquivo
`index.html` diretamente (sem servidor) não funciona corretamente, pois o
armazenamento local, o service worker e a sincronização exigem um endereço `http`.
Os arquivos `_serve.ps1` e `Abrir-M87.bat` destinam-se apenas a testes locais no
Windows e não precisam ser publicados.

## Observações sobre os dados
Sem a sincronização ativa, os dados ficam armazenados apenas no aparelho em uso, e a
limpeza dos dados do navegador os remove. Recomenda-se exportar um backup
periodicamente. Com a sincronização ativa, os dados também são mantidos na sua conta
do Firebase.
