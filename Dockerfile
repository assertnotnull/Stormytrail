FROM node:12-alpine
COPY echo.js /
CMD ["node", "echo.js"]