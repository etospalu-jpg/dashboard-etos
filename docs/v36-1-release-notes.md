# ETOS Dashboard v36.1

Scope: dashboard ETOS Palu only.

- PIN-gated modules: Coaching & IDP, Jurnal Pendampingan, Profil Fasilitator, System Center, Data Center, Pengaturan.
- Attendance is public-read; write actions remain PIN-gated.
- System Center table inventory is parallelized to avoid intermittent browser timeout.
- IDP Palu uses the configured Google Sheet `1OzW2RfiXL5SmqLOJx-t4Grimy7usdnSqVvSQszZ8WvQ`, gid `1973014346`.
- IDP prefers `GOOGLE_SERVICE_ACCOUNT_JSON` when configured and otherwise attempts read-only Google gviz access.
- No production deployment until preview and quality gates pass.
