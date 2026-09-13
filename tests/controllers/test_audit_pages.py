"""
Tests for the admin-facing review of the audit tables: the Flask-Admin log views and
the /audit pages and feed. See docs/specs/audit-logging-review.md, phase 6.
"""
import pytest


ADMIN_LOG_PAGES = ['/admin/submissionlog/', '/admin/courselog/', '/admin/rolelog/',
                   '/admin/assignmentlog/', '/admin/accesslog/', '/admin/errorlog/']


class TestAdminLogViews:

    @pytest.mark.parametrize("page", ADMIN_LOG_PAGES)
    def test_admin_can_list_every_log_table(self, client, test_data, act_as, page):
        act_as(test_data.user("admin@blockpy.com"))
        assert client.get(page).status_code == 200

    @pytest.mark.parametrize("page", ADMIN_LOG_PAGES)
    def test_non_admin_is_forbidden(self, client, test_data, act_as, page):
        act_as(test_data.user("ada@blockpy.com"))
        assert client.get(page).status_code == 403

    def test_audit_tables_are_read_only(self, client, test_data, act_as):
        act_as(test_data.user("admin@blockpy.com"))
        for page in ADMIN_LOG_PAGES[1:]:
            assert client.get(page + 'new/').status_code == 302
