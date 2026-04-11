package com.daakdash.tracking.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.stream.Collectors;

// catches what the service layer's own ResponseStatusException throws do not already cover,
// so a concurrency conflict or a bean validation failure never reaches a client as a raw
// whitelabel 500.
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    public record ApiError(int status, String error, String message, Instant timestamp) {}

    // a losing concurrent update. the caller's view of the shipment is stale, not wrong.
    @ExceptionHandler(OptimisticLockingFailureException.class)
    public ResponseEntity<ApiError> onConflict(OptimisticLockingFailureException ex) {
        return body(HttpStatus.CONFLICT, "someone else updated this shipment first, reload and try again");
    }

    // explicit business errors thrown by the service layer keep their own status and reason.
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiError> onResponseStatus(ResponseStatusException ex) {
        HttpStatusCode code = ex.getStatusCode();
        HttpStatus status = HttpStatus.resolve(code.value());
        String message = ex.getReason() != null ? ex.getReason()
            : (status != null ? status.getReasonPhrase() : "request failed");
        return ResponseEntity.status(code).body(new ApiError(code.value(),
            status != null ? status.getReasonPhrase() : "ERROR", message, Instant.now()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> onValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
            .map(e -> e.getField() + " " + e.getDefaultMessage())
            .collect(Collectors.joining(", "));
        return body(HttpStatus.BAD_REQUEST, message.isBlank() ? "invalid request" : message);
    }

    // last resort. logs the real exception server side, tells the client nothing internal.
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> onUnexpected(Exception ex) {
        log.error("unhandled exception", ex);
        return body(HttpStatus.INTERNAL_SERVER_ERROR, "something went wrong on our side");
    }

    private ResponseEntity<ApiError> body(HttpStatus status, String message) {
        return ResponseEntity.status(status)
            .body(new ApiError(status.value(), status.getReasonPhrase(), message, Instant.now()));
    }
}
