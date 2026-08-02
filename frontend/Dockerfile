FROM nginx:1.27-alpine

COPY nginx.docker.conf /etc/nginx/conf.d/default.conf

WORKDIR /usr/share/nginx/html

COPY *.html robots.txt sitemap.xml ./
COPY admin ./admin
COPY css ./css
COPY fonts ./fonts
COPY images ./images
COPY js ./js
