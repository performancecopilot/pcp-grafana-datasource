FROM docker.io/library/alpine:latest AS builder
RUN apk add --no-cache make git yarn go jsonnet && \
    go get -v github.com/jsonnet-bundler/jsonnet-bundler/cmd/jb && \
    mv /root/go/bin/jb /usr/local/bin

WORKDIR /usr/src/app
COPY . /usr/src/app
RUN make dist


FROM docker.io/grafana/grafana:latest
COPY docker/root/etc/grafana/grafana.ini /etc/grafana/grafana.ini
COPY --from=builder /usr/src/app/dist /var/lib/grafana/plugins/grafana-pcp
