package com.daakdash.auth.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

// sends real mail when MAIL_HOST is configured (gmail smtp with an app password works fine).
// without it the full mail is logged, so onboarding stays testable on a laptop.
@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final ObjectProvider<JavaMailSender> sender;
    private final String host;
    private final String from;

    public MailService(ObjectProvider<JavaMailSender> sender,
                       @Value("${spring.mail.host:}") String host,
                       @Value("${spring.mail.username:}") String from) {
        this.sender = sender;
        this.host = host;
        this.from = from;
    }

    public void send(String to, String subject, String body) {
        JavaMailSender s = sender.getIfAvailable();
        if (host.isBlank() || s == null) {
            log.info("mail (smtp not configured) to={} subject={}\n{}", to, subject, body);
            return;
        }
        try {
            SimpleMailMessage m = new SimpleMailMessage();
            m.setFrom(from);
            m.setTo(to);
            m.setSubject(subject);
            m.setText(body);
            s.send(m);
        } catch (Exception e) {
            // never fail onboarding because smtp hiccuped; the operator can resend
            log.error("mail send to {} failed: {}", to, e.getMessage());
            log.info("undelivered mail body:\n{}", body);
        }
    }
}
