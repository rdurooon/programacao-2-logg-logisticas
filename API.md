# API Logg Logísticas

Base local: `http://localhost:3000/api`

## Autenticação e perfis

Envie `Authorization: Bearer <token>` nas rotas protegidas. Obtenha o token em `POST /auth/login`. O servidor exige `JWT_SECRET` com pelo menos 32 bytes. `JWT_EXPIRES_IN` define a validade em segundos, com padrão de 3600.

Papéis disponíveis: `ADMIN`, `LOGISTICS_MANAGER`, `COURIER`, `CUSTOMER`, `USER` e `GUEST`.

| Perfil | Acesso principal |
| --- | --- |
| `ADMIN` | Usuários, clientes, endereços e operação completa |
| `LOGISTICS_MANAGER` | Clientes, endereços, ofertas, atribuição e operação completa |
| `COURIER` | Ofertas próprias, localização, ocorrências, status, cancelamento da própria entrega e confirmação |
| `CUSTOMER` | Criar entrega vinculada à própria conta, consultar suas entregas e notificações |

O primeiro `ADMIN` deve ser provisionado diretamente no banco ou por procedimento administrativo seguro. Não existe cadastro público de administrador.

## Rotas

`Público` não exige token. As demais rotas listadas exigem autenticação.

| Método | Rota | Acesso | Função |
| --- | --- | --- | --- |
| `GET` | `/` | Público | Retorna mensagem de disponibilidade da API. |
| `POST` | `/auth/login` | Público | Valida e-mail/senha e retorna token e dados públicos do usuário. |
| `GET` | `/auth/me` | Autenticado | Retorna os dados do usuário autenticado. |
| `GET` | `/users` | `ADMIN` | Lista usuários. Aceita `page`, `limit`, `q` e `orderBy`. |
| `GET` | `/users/:id` | `ADMIN` | Consulta um usuário sem retornar senha/hash. |
| `POST` | `/users` | `ADMIN` | Cria usuário, associa papéis e, opcionalmente, vincula cliente. |
| `PUT` | `/users/:id` | `ADMIN` | Atualiza nome, e-mail ou senha. A senha enviada é armazenada com hash. |
| `DELETE` | `/users/:id` | `ADMIN` | Exclui usuário. |
| `GET` | `/clientes` | `ADMIN`, `LOGISTICS_MANAGER` | Lista clientes. Aceita `page`, `limit` e `q`. |
| `GET` | `/clientes/:id` | `ADMIN`, `LOGISTICS_MANAGER` | Consulta cliente por ID. |
| `POST` | `/clientes` | `ADMIN`, `LOGISTICS_MANAGER` | Cadastra pessoa física ou jurídica. |
| `PUT` | `/clientes/:id` | `ADMIN`, `LOGISTICS_MANAGER` | Atualiza dados do cliente. |
| `DELETE` | `/clientes/:id` | `ADMIN`, `LOGISTICS_MANAGER` | Exclui cliente, respeitando vínculos existentes. |
| `GET` | `/enderecos` | `ADMIN`, `LOGISTICS_MANAGER` | Lista endereços. Aceita `page`, `limit`, `clienteId` e `q`. |
| `GET` | `/enderecos/:id` | `ADMIN`, `LOGISTICS_MANAGER` | Consulta endereço por ID. |
| `POST` | `/enderecos` | `ADMIN`, `LOGISTICS_MANAGER` | Cadastra endereço, podendo informar latitude e longitude juntas. |
| `PUT` | `/enderecos/:id` | `ADMIN`, `LOGISTICS_MANAGER` | Atualiza endereço. Coordenadas devem ser informadas em par. |
| `DELETE` | `/enderecos/:id` | `ADMIN`, `LOGISTICS_MANAGER` | Exclui endereço se não houver vínculo impeditivo. |
| `GET` | `/package/tracking/:code` | Público | Consulta status e histórico; divulga localização somente em rota e enquanto recente. |
| `GET` | `/package` | `ADMIN`, `LOGISTICS_MANAGER`, `COURIER`, `CUSTOMER` | Lista entregas conforme o perfil do usuário. Aceita `page`, `limit` e `q`. |
| `GET` | `/package/:id` | `ADMIN`, `LOGISTICS_MANAGER`, `COURIER`, `CUSTOMER` | Consulta entrega se o usuário tiver acesso a ela. |
| `POST` | `/package` | `ADMIN`, `LOGISTICS_MANAGER`, `CUSTOMER` | Cadastra entrega e evento inicial `Pendente`. |
| `PUT` | `/package/:id` | `ADMIN`, `LOGISTICS_MANAGER` | Atualiza dados de entrega ainda pendente. |
| `DELETE` | `/package/:id` | `ADMIN`, `LOGISTICS_MANAGER` | Compatibilidade: cancela sem apagar o histórico, usando motivo padrão. Prefira `POST /package/:id/cancel`. |
| `PATCH` | `/package/:id/status` | `ADMIN`, `LOGISTICS_MANAGER`, entregador atribuído | Avança para `Coletado`, `Em trânsito` ou `Em rota de entrega`. |
| `PATCH` | `/package/:id/courier` | `ADMIN`, `LOGISTICS_MANAGER` | Atribui ou reatribui entregador diretamente. |
| `POST` | `/package/:id/offers` | `ADMIN`, `LOGISTICS_MANAGER` | Cria oferta para um entregador específico. |
| `POST` | `/package/:id/offers/nearby` | `ADMIN`, `LOGISTICS_MANAGER` | Cria ofertas para entregadores com posição recente e sem entrega ativa, próximos da origem. |
| `GET` | `/package/offers` | `COURIER`, `ADMIN`, `LOGISTICS_MANAGER` | Lista ofertas pendentes do entregador ou, para gestão, todas as pendentes. |
| `POST` | `/package/offers/:offerId/respond` | Entregador destinatário | Aceita ou recusa oferta. Aceite atribui a entrega e retira outras ofertas pendentes. |
| `POST` | `/package/:id/cancel` | `ADMIN`, `LOGISTICS_MANAGER`, entregador atribuído | Cancela entrega com motivo e registra evento/notificação. |
| `PUT` | `/package/courier/location` | `COURIER` | Atualiza posição atual do entregador para ofertas por proximidade. |
| `POST` | `/package/:id/location` | Entregador atribuído | Registra posição durante a execução da entrega. |
| `GET` | `/package/:id/location` | Gestão, cliente proprietário, entregador atribuído | Consulta última posição; ao cliente, somente quando está em rota. |
| `POST` | `/package/:id/incidents` | Gestão, entregador atribuído | Registra ocorrência descritiva com evidência fotográfica obrigatória. |
| `GET` | `/package/:id/incidents` | Gestão, cliente proprietário, entregador atribuído | Lista ocorrências e evidências da entrega. |
| `POST` | `/package/:id/confirm-delivery` | Entregador atribuído | Confirma entrega se a última posição estiver recente e dentro do raio do destino. |
| `GET` | `/package/notifications` | Autenticado | Lista notificações do próprio usuário. Aceita `page` e `limit`. |
| `PATCH` | `/package/notifications/:notificationId/read` | Autenticado | Marca como lida uma notificação do próprio usuário. |

## Exemplos

### Login

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "email": "gestor@logg.com",
  "password": "SenhaSegura123"
}
```

Use o campo `token` retornado nas requisições protegidas:

```http
Authorization: Bearer <token>
```

### Criar usuário

`roles` pode ser omitido, caso em que a conta recebe `USER`. Para cliente final, informe `CUSTOMER` e o `clienteId` já cadastrado.

```http
POST /api/users
Authorization: Bearer <token-admin>
Content-Type: application/json
```

```json
{
  "name": "João Entregador",
  "email": "joao@logg.com",
  "password": "SenhaSegura123",
  "roles": ["COURIER"]
}
```

### Cadastrar cliente

Pessoa física:

```http
POST /api/clientes
Authorization: Bearer <token-gestor>
Content-Type: application/json
```

```json
{
  "tipoCliente": "F",
  "nome": "Mariana Costa",
  "fisica": {
    "cpf": "123.456.789-00",
    "rg": "1234567"
  }
}
```

Para pessoa jurídica, use `tipoCliente: "J"` e `juridica` com `cnpj` e, opcionalmente, `inscricaoEstadual`.

### Cadastrar endereço com coordenadas

Latitude e longitude devem estar ambas presentes ou ambas ausentes. O destino precisa de coordenadas para permitir confirmação por proximidade.

```http
POST /api/enderecos
Authorization: Bearer <token-gestor>
Content-Type: application/json
```

```json
{
  "clienteId": "<cliente-id>",
  "cep": "68900-000",
  "logradouro": "Rua Exemplo",
  "numero": "100",
  "complemento": "Sala 2",
  "bairro": "Centro",
  "cidade": "Macapá",
  "estado": "AP",
  "pais": "Brasil",
  "latitude": 0.0349,
  "longitude": -51.0694
}
```

### Criar entrega

O cliente autenticado pode omitir `clienteId`; a API usa o cliente vinculado à conta. Gestores devem informar `clienteId`. Origem e destino precisam pertencer ao mesmo cliente.

```http
POST /api/package
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "clienteId": "<cliente-id>",
  "description": "Caixa com documentos",
  "dimensions": "30x20x10 cm",
  "weight": 1.2,
  "originAddressId": "<endereco-origem-id>",
  "addressId": "<endereco-destino-id>"
}
```

A resposta inclui o código exclusivo de rastreio. Consulte-o sem token:

```http
GET /api/package/tracking/<codigo>
```

### Ofertar e aceitar

Oferta direcionada:

```http
POST /api/package/<entrega-id>/offers
Authorization: Bearer <token-gestor>
Content-Type: application/json
```

```json
{
  "courierId": "<entregador-id>"
}
```

Antes de solicitar ofertas por proximidade, o entregador atualiza sua posição atual. Essa posição também é atualizada automaticamente ao enviar localização de uma entrega.

```http
PUT /api/package/courier/location
Authorization: Bearer <token-entregador>
Content-Type: application/json
```

```json
{
  "latitude": 0.0351,
  "longitude": -51.0692
}
```

Oferta por proximidade, com raio padrão de 5 km e até 3 entregadores disponíveis:

```http
POST /api/package/<entrega-id>/offers/nearby
Authorization: Bearer <token-gestor>
Content-Type: application/json
```

```json
{
  "radiusMeters": 5000,
  "limit": 3
}
```

O entregador consulta `GET /api/package/offers` e responde à oferta recebida:

```http
POST /api/package/offers/<oferta-id>/respond
Authorization: Bearer <token-entregador>
Content-Type: application/json
```

```json
{
  "accepted": true
}
```

Use `false` para recusar. A recusa é registrada no histórico e notificada à gestão/solicitante.

### Cancelar ou reatribuir

```http
POST /api/package/<entrega-id>/cancel
Authorization: Bearer <token-gestor-ou-entregador-atribuido>
Content-Type: application/json
```

```json
{
  "reason": "Impossibilidade operacional informada pelo entregador"
}
```

Para atribuir diretamente ou reatribuir, a gestão pode usar `PATCH /api/package/<entrega-id>/courier`:

```json
{
  "courierId": "<novo-entregador-id>"
}
```

### Atualizar localização e status

O entregador atribuído pode enviar coordenadas válidas entre latitude `-90..90` e longitude `-180..180` enquanto o status estiver `Coletado`, `Em trânsito` ou `Em rota de entrega`:

```http
POST /api/package/<entrega-id>/location
Authorization: Bearer <token-entregador>
Content-Type: application/json
```

```json
{
  "latitude": 0.0351,
  "longitude": -51.0692
}
```

Para avançar o status, use `PATCH /api/package/<entrega-id>/status` com um dos valores permitidos:

```json
{
  "status": "Em rota de entrega"
}
```

`Entregue` não pode ser definido por essa rota; use a confirmação por proximidade.

### Registrar ocorrência com foto

Envie uma imagem JPEG, PNG ou WebP como data URI Base64. A imagem é limitada a 8 MB e a descrição deve ter entre 5 e 2000 caracteres.

```http
POST /api/package/<entrega-id>/incidents
Authorization: Bearer <token-entregador-atribuido>
Content-Type: application/json
```

```json
{
  "description": "Embalagem danificada durante o transporte",
  "photo": "data:image/jpeg;base64,<conteudo-base64-completo-da-imagem>"
}
```

A lista e evidências podem ser consultadas em `GET /api/package/<entrega-id>/incidents` por gestão, cliente proprietário e entregador atribuído.

### Confirmar entrega

Após registrar uma posição recente com `POST /api/package/<entrega-id>/location` e avançar para `Em rota de entrega`:

```http
POST /api/package/<entrega-id>/confirm-delivery
Authorization: Bearer <token-entregador-atribuido>
```

O destino deve ter latitude/longitude. O raio padrão é 100 m; configure `DELIVERY_CONFIRMATION_RADIUS_METERS` para alterá-lo. A posição é considerada recente por até 300 segundos, configurável com `DELIVERY_LOCATION_MAX_AGE_SECONDS` (mínimo efetivo de 30 segundos).

### Consultar notificações

```http
GET /api/package/notifications?page=1&limit=20
Authorization: Bearer <token>
```

Marcar notificação própria como lida:

```http
PATCH /api/package/notifications/<notificacao-id>/read
Authorization: Bearer <token>
```

As notificações são persistidas e consultadas por polling nesta API; esta etapa não integra envio por push, SMS ou e-mail.

## Regras e respostas

- As transições operacionais são `Pendente → Coletado → Em trânsito → Em rota de entrega → Entregue`. Cancelamento é permitido antes de `Entregue`.
- Cada mudança, aceite/recusa, atribuição e cancelamento gera evento de auditoria quando aplicável.
- `400` indica payload inválido; `401` token ausente/inválido; `403` perfil ou vínculo sem permissão; `404` recurso inexistente; `409` conflito de estado/regra; `413` evidência acima do limite.
- Localização de cliente só é revelada quando o status está `Em rota de entrega` e a posição não está expirada.
- Oferta por proximidade depende de posição atualizada nos últimos 10 minutos; entregadores sem posição recente ou com entrega ativa não entram na seleção.
