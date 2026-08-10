package com.suin.fincoach;

import java.util.TimeZone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@SpringBootApplication
public class FincoachApplication {

	public static void main(String[] args) {
		// 배포 환경(Railway)의 서버 기본 타임존이 UTC라, 이걸 안 맞추면 LocalDate.now() 같은 호출이
		// 한국 새벽~오전 시간대에 하루 전 날짜를 반환하고, 고정지출 00:05 스케줄러도 실제로는
		// KST 09:05에 도는 문제가 생긴다. 앱 전체 기준시를 한국시간으로 고정해 근본적으로 막는다.
		TimeZone.setDefault(TimeZone.getTimeZone("Asia/Seoul"));
		SpringApplication.run(FincoachApplication.class, args);
	}

}