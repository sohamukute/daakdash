package com.daakdash.auth.controller;

import com.daakdash.auth.dto.SellerInfo;
import com.daakdash.auth.model.Role;
import com.daakdash.auth.repository.UserRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/admin")
public class AdminUserController {

    private final UserRepository users;

    public AdminUserController(UserRepository users) { this.users = users; }

    @GetMapping("/sellers")
    public List<SellerInfo> sellers(@RequestHeader(value = "X-User-Role", required = false) String role) {
        if (!"ADMIN".equals(role)) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        return users.findByRole(Role.SELLER).stream()
            .map(u -> new SellerInfo(u.getName(), u.getGstNumber(), u.getAddress(),
                u.getContactEmail(), u.getPhone(), u.getEmail(), u.getCreatedAt()))
            .toList();
    }
}
