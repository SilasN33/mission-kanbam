# Mission Kanban

Kanban enxuto para coordenar o OpenClaw Mission Control. Sem 3D, sem mapa: apenas um board rápido para organizar tarefas.

## Stack
- React + Vite
- CSS puro (glassmorphism leve)

## Como rodar
```bash
npm install
npm run dev
```
Abre em http://localhost:5173.

## Fluxo
- Colunas fixas: Backlog → In Progress → Review → Done.
- Cards possuem ID, título, owner e descrição.
- Botões ◀ ▶ movem o card entre colunas.
- Form no final adiciona novos cards diretamente no Backlog.
- Botão "Reset" volta para os seeds originais.

## Deploy (opcional)
Build estático:
```bash
npm run build
npm run preview
```
Gera artefatos em `dist/` prontos para qualquer host estático.
