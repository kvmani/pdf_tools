"""Prometheus metrics helpers for pdf_tools."""

from __future__ import annotations

from prometheus_client import Counter, Histogram, generate_latest

request_latency = Histogram(
    "pdf_tools_request_latency_seconds",
    "Request latency in seconds",
    ["endpoint"],
)

request_count = Counter(
    "pdf_tools_request_total",
    "Total HTTP requests",
    ["endpoint", "status"],
)


def metrics_response():
    """Return metrics for Prometheus scraping."""
    return (
        generate_latest(),
        200,
        {"Content-Type": "text/plain; version=0.0.4"},
    )
