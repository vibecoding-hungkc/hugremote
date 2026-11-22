# Máy SSH thử cho dev/test/dogfood: OpenSSH + git + python3 + dự án mẫu demo-api (60 commit, remote bare để push)
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssh-server git python3 ca-certificates htop less procps \
 && rm -rf /var/lib/apt/lists/* && mkdir -p /run/sshd
RUN useradd -m -s /bin/bash dev && mkdir -p /home/dev/.ssh && chmod 700 /home/dev/.ssh && chown -R dev:dev /home/dev/.ssh
COPY docker/sshd/sshd_config /etc/ssh/sshd_config
COPY fake-claude/claude /usr/local/bin/claude
COPY docker/sshd/seed-projects.sh /usr/local/bin/seed-projects.sh
COPY docker/sshd/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/*.sh && su dev -c /usr/local/bin/seed-projects.sh
EXPOSE 22
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
