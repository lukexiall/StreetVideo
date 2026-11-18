## Primary model: multilevel log-normal AFT, 4-knot RCS on camera-view GVI (tramME)
suppressMessages({library(tramME); library(survival)})
args <- commandArgs(TRUE); dat_dir <- args[1]; out_dir <- args[2]
d <- read.csv(file.path(dat_dir, "ped.csv"))
g <- read.csv(file.path(dat_dir, "gvi.csv"))
d$street  <- relevel(factor(d$street), "Hindley")
d$season  <- factor(d$season, c("winter","spring","summer"))
d$period  <- factor(d$period, c("morning","noon","late_afternoon"))
d$day_type<- factor(d$day_type, c("weekday","weekend"))
d$segment <- factor(d$segment); d$session <- factor(d$session)

## knots at 5/35/65/95th percentiles of the 300 segment x season GVI values
knots <- unname(quantile(g$GVI_seasonal, c(.05,.35,.65,.95)))
rcs_basis <- function(x, k = knots) {          # Harrell RCS, norm = (k_K - k_1)^2
  K <- length(k); nrm <- (k[K]-k[1])^2; p <- function(u) pmax(u,0)^3
  B <- sapply(1:(K-2), function(j)
    (p(x-k[j]) - p(x-k[K-1])*(k[K]-k[j])/(k[K]-k[K-1]) + p(x-k[K])*(k[K-1]-k[j])/(k[K]-k[K-1]))/nrm)
  B <- cbind(x, matrix(B, ncol = K-2)); colnames(B) <- paste0("gvi", 1:(K-1)); B
}
d <- cbind(d, rcs_basis(d$GVI_seasonal))
zs <- c("air_temp_BoM_S4_C","FAR","functional_mix","HW_ratio","footpath_m","POI_per100m")
sds <- sapply(d[zs], sd)
for (v in zs) d[[paste0(v,"_z")]] <- (d[[v]] - mean(d[[v]]))/sds[v]

sp   <- "gvi1 + gvi2 + gvi3"
temp <- "season + period + day_type + air_temp_BoM_S4_C_z"
built<- "FAR_z + functional_mix_z + HW_ratio_z + footpath_m_z + seating + outdoor_dining + POI_per100m_z + bus_stop + crossing"
sets <- list(Base = "", Temporal = temp, Built = built, Full = paste(temp, built, sep = " + "))
which_sets <- if (length(args) > 2) strsplit(args[3], ",")[[1]] else names(sets)

levels_show <- c(5,10,15,20,25,30)
res <- list()
for (s in which_sets) {
  rhs <- paste(c(sp, "street", if (nzchar(sets[[s]])) sets[[s]]), collapse = " + ")
  f <- as.formula(paste("Surv(duration_s, departure_status) ~", rhs, "+ (1|segment) + (1|session)"))
  t0 <- Sys.time()
  m <- SurvregME(f, data = d, dist = "lognormal",
                 control = optim_control(control = list(iter.max = 5000, eval.max = 10000)))
  cat("convergence code:", m$opt$convergence, m$opt$message, "\n")
  if (m$opt$convergence != 0) warning("NOT CONVERGED: ", s)
  cat("\n=====", s, "fitted in", round(difftime(Sys.time(), t0, units="mins"),1), "min; logLik", logLik(m), "\n")
  saveRDS(m, file.path(out_dir, paste0("fit_", s, ".rds")))
  ## tram parameterisation: Phi(th1 + th2*log t - x'b). log-median = (x'b - th1)/th2  => survreg beta = b/th2
  cf <- coef(m, with_baseline = TRUE); V <- vcov(m, pargroup = "fixef")
  stopifnot(identical(names(cf), rownames(V)))
  th2 <- names(cf)[2]   # log(duration) coefficient = 1/sigma
  ## AFT coefficients (survreg scale) with delta-method SE
  sh <- setdiff(names(cf), names(cf)[1:2])
  aft <- t(sapply(sh, function(p) {
    gr <- setNames(rep(0, length(cf)), names(cf)); gr[p] <- 1/cf[th2]; gr[th2] <- -cf[p]/cf[th2]^2
    c(est = unname(cf[p]/cf[th2]), se = sqrt(drop(t(gr) %*% V %*% gr)))
  }))
  write.csv(aft, file.path(out_dir, paste0("aft_coef_", s, ".csv")))
  cat("sigma =", 1/cf[th2], "\n")
  ## Joint Wald tests on spline terms (shift params; scaling by th2 does not change H0)
  b <- cf[c("gvi1","gvi2","gvi3")]; Vb <- V[names(b), names(b)]
  W  <- drop(t(b) %*% solve(Vb) %*% b)
  bn <- cf[c("gvi2","gvi3")]; Wn <- drop(t(bn) %*% solve(V[names(bn),names(bn)]) %*% bn)
  cat(sprintf("Overall GVI Wald chi2(3) = %.2f, p = %.3g; Non-linear chi2(2) = %.2f, p = %.3g\n",
      W, pchisq(W,3,lower=FALSE), Wn, pchisq(Wn,2,lower=FALSE)))
  ## Standardised predicted median (REs = 0), averaged over observed covariates
  X  <- model.matrix(as.formula(paste("~", rhs)), d)[, -1, drop = FALSE]
  bx <- cf[colnames(X)]; stopifnot(!anyNA(bx))
  lp_rest <- drop(X[, setdiff(colnames(X), names(b)), drop=FALSE] %*% bx[setdiff(colnames(X), names(b))])
  ## exact: mean_i exp((s(g) + rest_i - th1)/th2), with rest_i depending on par too
  Xr <- X[, setdiff(colnames(X), names(b)), drop = FALSE]
  med <- function(par, gv) mean(exp((drop(rcs_basis(gv) %*% par[names(b)]) + drop(Xr %*% par[colnames(Xr)]) - par[names(cf)[1]]) / par[th2]))
  numgrad <- function(fn, par, h = 1e-5) sapply(seq_along(par), function(i) { e <- replace(0*par, i, h); (fn(par+e)-fn(par-e))/(2*h) })
  tab <- do.call(rbind, lapply(levels_show, function(gv) {
    lm_ <- function(p) log(med(p, gv)); gr <- numgrad(lm_, cf); se <- sqrt(drop(t(gr) %*% V %*% gr))
    lt <- function(p) log(med(p, gv)) - log(med(p, 5)); gt <- numgrad(lt, cf); set <- sqrt(drop(t(gt) %*% V %*% gt))
    est <- lm_(cf); ltr <- lt(cf)
    data.frame(model = s, GVI = gv, median = exp(est), lo = exp(est-1.96*se), hi = exp(est+1.96*se),
               TR_vs5 = exp(ltr), TR_lo = exp(ltr-1.96*set), TR_hi = exp(ltr+1.96*set),
               p_vs5 = if (gv == 5) NA else 2*pnorm(-abs(ltr/set)))
  }))
  ## TR 20 vs 10 (for robustness figures)
  lt2 <- function(p) log(med(p, 20)) - log(med(p, 10)); g2 <- numgrad(lt2, cf); se2 <- sqrt(drop(t(g2) %*% V %*% g2))
  cat(sprintf("TR 20 vs 10%% = %.3f (%.3f-%.3f)\n", exp(lt2(cf)), exp(lt2(cf)-1.96*se2), exp(lt2(cf)+1.96*se2)))
  print(format(tab, digits = 4), row.names = FALSE)
  res[[s]] <- tab
  print(VarCorr(m))
}
write.csv(do.call(rbind, res), file.path(out_dir, "table4_predictions.csv"), row.names = FALSE)
cat("\nknots:", knots, "\nSDs used for standardisation:\n"); print(sds)
