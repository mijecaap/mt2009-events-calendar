FROM nginx:alpine
COPY index.html styles.css app.js logic.js /usr/share/nginx/html/
COPY sketches /usr/share/nginx/html/sketches
EXPOSE 80
