# Maze Kids — iOS PWA генератор лабиринтов

PWA-приложение для генерации лабиринтов разных форм и сложности.

## Возможности

- Формы: квадрат, треугольник, ромб, круг, многоугольник
- Сложность от 1 до 10
- На сложных уровнях больше тупиков
- Seed-генерация
- Показ решения
- Скачать SVG
- Печать чистого лабиринта без лишних надписей
- Поделиться через Web Share API
- PWA manifest + service worker
- Автодеплой на GitHub Pages через GitHub Actions

## Запуск локально

```bash
npm install
npm run dev
```

## Сборка

```bash
npm run build
npm run preview
```

## Загрузка на GitHub

```bash
git init
git add .
git commit -m "Initial maze PWA"
git branch -M main
git remote add origin https://github.com/9ReST/maze-generaiting.git
git push -u origin main
```

Если remote уже добавлен:

```bash
git remote set-url origin https://github.com/9ReST/maze-generaiting.git
git push -u origin main
```

## Включить GitHub Pages

После push зайди в репозиторий:

Settings → Pages → Build and deployment → Source → GitHub Actions

После выполнения action сайт будет доступен примерно так:

https://9rest.github.io/maze-generaiting/

## Установка на iPhone

1. Открой сайт в Safari
2. Нажми Share / Поделиться
3. Add to Home Screen / На экран «Домой»
4. Запусти приложение с иконки
